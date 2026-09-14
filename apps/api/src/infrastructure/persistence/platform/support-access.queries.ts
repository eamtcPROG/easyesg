import { SUPPORT_ACCESS_ENTRY_KIND } from '@api/modules/platform/support-access/models/support-access-log.model';
import type { SupportAccessReadPurpose } from '@api/modules/platform/support-access/models/support-access-log.model';
import type {
  SupportAccessActorRealm,
  SupportAccessDecisionKind,
  SupportAccessDecisionRecord,
  SupportAccessHistory,
  SupportAccessRequestRecord,
} from '@api/modules/platform/support-access/models/support-access-request.model';

/**
 * `audit.support_access_log`'s grant half, as SQL (task 67.9) — shared by the three stores that read or write
 * it, each on a connection of its own kind: the tenant request's, a platform connection bound to one
 * organization, and `esg_admin_ro`'s. **The queries are the same whichever connection runs them**, and what
 * differs is what the connection's policies let it see — which is the point of keeping them in one place.
 */

/** Runs one statement on whichever connection the caller holds. */
export type Run = (sql: string, parameters?: unknown[]) => Promise<unknown>;

interface RequestRow {
  id: string;
  organization_id: string;
  requester_id: string;
  requester_email: string | null;
  ticket_reference: string;
  reason: string;
  occurred_at: Date;
}

interface DecisionRow {
  request_id: string;
  entry_kind: SupportAccessDecisionKind;
  actor_id: string;
  actor_realm: SupportAccessActorRealm;
  actor_email: string | null;
  occurred_at: Date;
}

/**
 * A request row with its requester's address. **The requester is an admin account**, so the address comes
 * from `identity.admin_account`, which is what the organization's banner names.
 */
export const REQUEST_SELECT = `
  SELECT l.id, l.organization_id, l.requester_id, requester.email AS requester_email,
         l.ticket_reference, l.reason, l.occurred_at
    FROM audit.support_access_log l
    LEFT JOIN identity.admin_account requester ON requester.id = l.requester_id`;

export const toRequestRecord = (row: RequestRow): SupportAccessRequestRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  requesterId: row.requester_id,
  requesterEmail: row.requester_email,
  ticketReference: row.ticket_reference,
  reason: row.reason,
  requestedAt: row.occurred_at,
});

const DECISION_KINDS = [
  SUPPORT_ACCESS_ENTRY_KIND.GRANT,
  SUPPORT_ACCESS_ENTRY_KIND.DECLINE,
  SUPPORT_ACCESS_ENTRY_KIND.END,
];

/**
 * The grant, decline and end rows against the given requests, oldest first. **Each actor's address comes
 * from its own realm's table** — a tenant account for the organization's decisions, an admin account for a
 * platform end — and is `null` where the connection's policies do not let it read that table's row.
 */
export const decisionsFor = async (
  run: Run,
  requestIds: readonly string[],
): Promise<SupportAccessDecisionRecord[]> => {
  if (requestIds.length === 0) return [];
  const rows = (await run(
    `SELECT l.request_id, l.entry_kind, l.actor_id, l.actor_realm,
            coalesce(member.email, operator.email) AS actor_email, l.occurred_at
       FROM audit.support_access_log l
       LEFT JOIN identity.account member
              ON l.actor_realm = 'organization' AND member.id = l.actor_id
       LEFT JOIN identity.admin_account operator
              ON l.actor_realm = 'platform' AND operator.id = l.actor_id
      WHERE l.entry_kind = ANY($1::text[]) AND l.request_id = ANY($2::uuid[])
      ORDER BY l.occurred_at, l.id`,
    [DECISION_KINDS, requestIds],
  )) as DecisionRow[];

  return rows.map((row) => ({
    requestId: row.request_id,
    kind: row.entry_kind,
    actorId: row.actor_id,
    actorRealm: row.actor_realm,
    actorEmail: row.actor_email,
    occurredAt: row.occurred_at,
  }));
};

/** Requests matching `where` (parameters from `$2`), with the rows answering them. */
export const historyWhere = async (
  run: Run,
  where: string,
  parameters: readonly unknown[],
): Promise<SupportAccessHistory> => {
  const rows = (await run(
    `${REQUEST_SELECT} WHERE l.entry_kind = $1 AND ${where} ORDER BY l.occurred_at DESC, l.id DESC`,
    [SUPPORT_ACCESS_ENTRY_KIND.REQUEST, ...parameters],
  )) as RequestRow[];
  const requests = rows.map(toRequestRecord);
  return { requests, decisions: await decisionsFor(run, requests.map((request) => request.id)) };
};

/** One request by id, with its rows; `null` where the connection sees no such request. */
export const requestHistory = async (
  run: Run,
  requestId: string,
): Promise<SupportAccessHistory | null> => {
  const history = await historyWhere(run, 'l.id = $2', [requestId]);
  return history.requests.length === 0 ? null : history;
};

/**
 * One row of the log. **Every column the row kinds use, positionally, so the three writers cannot disagree
 * about which is which** — the migration's shape check is the database's copy of which kind carries what.
 */
export interface SupportAccessLogRow {
  readonly id: string;
  readonly at: Date;
  readonly kind: (typeof SUPPORT_ACCESS_ENTRY_KIND)[keyof typeof SUPPORT_ACCESS_ENTRY_KIND];
  readonly requestId: string | null;
  readonly requesterId: string;
  readonly organizationId: string;
  readonly actorId: string | null;
  readonly actorRealm: SupportAccessActorRealm | null;
  readonly ticketReference: string | null;
  readonly reason: string | null;
  readonly purpose: SupportAccessReadPurpose | null;
  readonly subject: string | null;
}

export const insertLogRow = async (run: Run, row: SupportAccessLogRow): Promise<void> => {
  await run(
    `INSERT INTO audit.support_access_log
       (id, occurred_at, entry_kind, request_id, requester_id, organization_id,
        actor_id, actor_realm, ticket_reference, reason, purpose, subject)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      row.id,
      row.at,
      row.kind,
      row.requestId,
      row.requesterId,
      row.organizationId,
      row.actorId,
      row.actorRealm,
      row.ticketReference,
      row.reason,
      row.purpose,
      row.subject,
    ],
  );
};
