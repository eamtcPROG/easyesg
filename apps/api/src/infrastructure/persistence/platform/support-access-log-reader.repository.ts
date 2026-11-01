import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import type {
  SupportAccessLogReader,
  SupportAccessLogRequestRecord,
  SupportAccessLogRows,
} from '@api/modules/platform/support-access/interfaces/support-access-log-reader.interface';
import {
  ACQUISITION_PURPOSE,
  SUPPORT_ACCESS_ENTRY_KIND,
  type SupportAccessReadPurpose,
} from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { decisionsFor, toRequestRecord, type Run } from './support-access.queries';

/**
 * A-07's log (task 67.9; UC-86, FR-79) — through `esg_admin_ro`, logged first.
 *
 * **Why the `BYPASSRLS` role**: the log crosses every organization, and a request row is visible to `esg_app`
 * only with its own organization bound. So reading A-07's log leaves an acquisition in the very log it reads,
 * which is the honest consequence of reading something only a bypass can — A-08's reason, once more.
 *
 * **Names come from three tables the role reads**: the organization's from `core.organization`, the
 * requester's and a platform ender's from `identity.admin_account (id, email)`, and a deciding member's from
 * `identity.account`. **Acquisitions are never selected** — they are the log of reading, not of support
 * access, and A-07 lists requests.
 */
@Injectable()
export class SupportAccessLogReaderRepository implements SupportAccessLogReader {
  constructor(private readonly adminReadOnly: AdminReadOnly) {}

  list(read: {
    readonly requesterId: string;
    readonly take: number;
    readonly skip: number;
  }): Promise<SupportAccessLogRows> {
    return this.adminReadOnly.acquire(
      { requesterId: read.requesterId, purpose: ACQUISITION_PURPOSE.SUPPORT_ACCESS_LOG, organizationId: null },
      async (runner: QueryRunner) => {
        const run: Run = (sql, parameters) => runner.query(sql, parameters as unknown[]);

        const [counted] = (await run(
          `SELECT count(*)::int AS total FROM audit.support_access_log WHERE entry_kind = $1`,
          [SUPPORT_ACCESS_ENTRY_KIND.REQUEST],
        )) as { total: number }[];

        const rows = (await run(
          `SELECT l.id, l.organization_id, organization.name AS organization_name,
                  l.requester_id, requester.email AS requester_email,
                  l.ticket_reference, l.reason, l.occurred_at
             FROM audit.support_access_log l
             LEFT JOIN core.organization organization ON organization.id = l.organization_id
             LEFT JOIN identity.admin_account requester ON requester.id = l.requester_id
            WHERE l.entry_kind = $1
            ORDER BY l.occurred_at DESC, l.id DESC
            LIMIT $2 OFFSET $3`,
          [SUPPORT_ACCESS_ENTRY_KIND.REQUEST, read.take, read.skip],
        )) as (Parameters<typeof toRequestRecord>[0] & { organization_name: string | null })[];

        const requests: SupportAccessLogRequestRecord[] = rows.map((row) => ({
          ...toRequestRecord(row),
          organizationName: row.organization_name,
        }));
        const requestIds = requests.map((request) => request.id);

        const accesses =
          requestIds.length === 0
            ? []
            : ((await run(
                `SELECT request_id, purpose, subject, occurred_at
                   FROM audit.support_access_log
                  WHERE entry_kind = $1 AND request_id = ANY($2::uuid[])
                  ORDER BY occurred_at, id`,
                [SUPPORT_ACCESS_ENTRY_KIND.ACCESS, requestIds],
              )) as { request_id: string; purpose: SupportAccessReadPurpose; subject: string | null; occurred_at: Date }[]);

        return {
          requests,
          decisions: await decisionsFor(run, requestIds),
          accesses: accesses.map((row) => ({
            requestId: row.request_id,
            purpose: row.purpose,
            subject: row.subject,
            occurredAt: row.occurred_at,
          })),
          total: counted.total,
        };
      },
    );
  }
}
