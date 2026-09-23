import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import { isSocialProvider } from '@api/contracts/identity-provider.port';
import { isNotificationCategoryKey } from '@api/contracts/notification.port';
import { IDENTITY_PROVIDER_CONFIG_KIND } from '@api/modules/identity/provider/constants/provider.constants';
import { NOTIFICATION_CATEGORY_CONFIG_KIND } from '@api/modules/platform/notification/constants/notification-category.constants';
import type {
  SystemAuditLogRead,
  SystemAuditLogReader,
} from '@api/modules/platform/admin/interfaces/system-audit-log-reader.interface';
import type {
  SystemAuditLogEntry,
  SystemAuditLogPage,
} from '@api/modules/platform/admin/models/system-audit-log.model';
import {
  AUDIT_ACTION,
  isAuditAction,
} from '@api/modules/platform/audit/models/audit-action.model';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';

/**
 * A-08's read of `audit.system_audit_log` (task 67.4; UC-88) — through `esg_admin_ro`, logged first.
 *
 * **Why the `BYPASSRLS` role**: a platform row has no organization, and the table's select policy
 * compares `organization_id` for equality, so no row matches for `esg_app` or for its owner
 * (`apps/api/CLAUDE.md` records the hour that cost). The role is the documented route, and §7.6 makes
 * every acquisition of it a logged one — so reading A-08's log leaves a row in the support access log,
 * which is the honest consequence of reading something only a bypass can.
 *
 * **Platform rows only** (`organization_id IS NULL`): a row bound to a tenant is that tenant's, and
 * A-08 is not a support-access grant. **Only actions this release knows** — a row an older or newer
 * release wrote under a spelling this one does not have would reach a client that cannot label it,
 * and the counts are taken over the same set so the pager agrees with the rows.
 *
 * **Names, from two column grants**: the operator's and the target's address, joined by id over
 * `identity.admin_account (id, email)` and `identity.admin_invitation (id, email)` — nothing else of
 * either table is readable by this role. The pseudonymous `subject` is never selected: it groups
 * attempts and is not a thing to show. **Since task 67.11 a target may be a configuration version** — A-18's
 * writes name the version they put in force, a provider having no id of its own — and it is named by the
 * provider it configures, read from `config.entry_version`, which this role reads already — and since task 67.10 A-17's
 * writes name theirs the same way, by the notification category the version configures.
 */
@Injectable()
export class SystemAuditLogReaderRepository implements SystemAuditLogReader {
  constructor(private readonly adminReadOnly: AdminReadOnly) {}

  list(read: SystemAuditLogRead): Promise<SystemAuditLogPage> {
    const { query } = read;

    return this.adminReadOnly.acquire(
      { requesterId: read.requesterId, purpose: ACQUISITION_PURPOSE.SYSTEM_AUDIT_LOG, organizationId: null },
      async (runner: QueryRunner) => {
        const known = Object.values(AUDIT_ACTION);
        const filters = [known, query.operatorId, query.action, query.from, query.to];

        const [counts] = (await runner.query(
          `SELECT count(*) FILTER (WHERE ${PLATFORM})::int AS total,
                  count(*) FILTER (WHERE ${PLATFORM} AND ${MATCHES})::int AS matched
             FROM audit.system_audit_log l`,
          filters,
        )) as { total: number; matched: number }[];

        const rows = (await runner.query(
          `SELECT l.id, l.occurred_at, l.action,
                  l.actor_id, actor.email AS actor_email,
                  l.target_id, coalesce(target_account.email, target_invitation.email) AS target_email,
                  target_configuration.kind AS target_kind, target_configuration.scope AS target_scope
             FROM audit.system_audit_log l
             LEFT JOIN identity.admin_account    actor                ON actor.id = l.actor_id
             LEFT JOIN identity.admin_account    target_account       ON target_account.id = l.target_id
             LEFT JOIN identity.admin_invitation target_invitation    ON target_invitation.id = l.target_id
             LEFT JOIN config.entry_version      target_configuration ON target_configuration.id = l.target_id
                                                                     AND target_configuration.kind = ANY($8::text[])
            WHERE ${PLATFORM} AND ${MATCHES}
            ORDER BY l.occurred_at DESC, l.id DESC
            LIMIT $6 OFFSET $7`,
          [...filters, query.take, query.skip, [IDENTITY_PROVIDER_CONFIG_KIND, NOTIFICATION_CATEGORY_CONFIG_KIND]],
        )) as SystemAuditLogRow[];

        return {
          entries: rows.flatMap((row) => toEntry(row) ?? []),
          matched: counts.matched,
          total: counts.total,
        };
      },
    );
  }
}

/** A platform event this release can label. `$1` is `AUDIT_ACTION`'s values. */
const PLATFORM = `l.organization_id IS NULL AND l.action = ANY($1::text[])`;

/** Each filter is off while its parameter is null — the register's `MATCHES` shape. */
const MATCHES = `($2::uuid IS NULL OR l.actor_id = $2::uuid)
             AND ($3::text IS NULL OR l.action = $3::text)
             AND ($4::timestamptz IS NULL OR l.occurred_at >= $4::timestamptz)
             AND ($5::timestamptz IS NULL OR l.occurred_at < $5::timestamptz)`;

interface SystemAuditLogRow {
  id: string;
  occurred_at: Date;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  target_id: string | null;
  target_email: string | null;
  target_kind: string | null;
  target_scope: string | null;
}

const toEntry = (row: SystemAuditLogRow): SystemAuditLogEntry | null =>
  isAuditAction(row.action)
    ? {
        id: row.id,
        occurredAt: row.occurred_at,
        action: row.action,
        actor: row.actor_id === null ? null : { id: row.actor_id, email: row.actor_email },
        target:
          row.target_id === null
            ? null
            : {
                id: row.target_id,
                email: row.target_email,
                provider: configuredBy(row, IDENTITY_PROVIDER_CONFIG_KIND, isSocialProvider),
                category: configuredBy(row, NOTIFICATION_CATEGORY_CONFIG_KIND, isNotificationCategoryKey),
              },
      }
    : null;

/** The scope of a configuration version the event acted on, where it is of `kind` and names a member this release knows. */
const configuredBy = <T extends string>(
  row: SystemAuditLogRow,
  kind: string,
  isMember: (value: string) => value is T,
): T | null =>
  row.target_kind === kind && row.target_scope !== null && isMember(row.target_scope) ? row.target_scope : null;
