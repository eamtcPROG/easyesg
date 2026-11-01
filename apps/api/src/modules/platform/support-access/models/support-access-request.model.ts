import type { SUPPORT_ACCESS_ENTRY_KIND, SupportAccessReadPurpose } from './support-access-log.model';

/**
 * A support-access request and what became of it (task 67.9; UC-85, FR-78; `architecture.md` §12.5.6's
 * task-67.9 row) — the rows `audit.support_access_log` holds for it, and the state folded from them.
 *
 * **There is no request table, and so no stored state.** A request is a row, and every grant, decline
 * and end is a row against it carrying its id; *awaiting*, *lapsed*, *active* and *expired* are what
 * the clock says of those rows (`domain/support-access-request.ts`). That is what lets FR-78's *expires
 * without administrator action* hold with no job and no row written at expiry.
 */

/** Where a request stands, as the log and the clock together say. */
export const SUPPORT_ACCESS_STATE = {
  /** Raised, and no Organization Administrator has answered — for 24 hours. */
  AWAITING: 'awaiting',
  /** Granted, and neither ended nor past its 60 minutes. The only state that permits a read. */
  ACTIVE: 'active',
  DECLINED: 'declined',
  /** Nobody answered within 24 hours. */
  LAPSED: 'lapsed',
  /** Granted, then ended early — by an Organization Administrator or a Platform Administrator. */
  ENDED: 'ended',
  /** Granted, and its 60 minutes ran out. */
  EXPIRED: 'expired',
} as const;

export type SupportAccessState = (typeof SUPPORT_ACCESS_STATE)[keyof typeof SUPPORT_ACCESS_STATE];

/** Which realm's account took a decision: the organization's own, or the platform's. */
export const SUPPORT_ACCESS_ACTOR_REALM = {
  ORGANIZATION: 'organization',
  PLATFORM: 'platform',
} as const;

export type SupportAccessActorRealm =
  (typeof SUPPORT_ACCESS_ACTOR_REALM)[keyof typeof SUPPORT_ACCESS_ACTOR_REALM];

/** The three rows that answer a request. The `CHECK` in the task-67.9 migration is the database's copy. */
export type SupportAccessDecisionKind =
  | typeof SUPPORT_ACCESS_ENTRY_KIND.GRANT
  | typeof SUPPORT_ACCESS_ENTRY_KIND.DECLINE
  | typeof SUPPORT_ACCESS_ENTRY_KIND.END;

/** A request row. */
export interface SupportAccessRequestRecord {
  readonly id: string;
  readonly organizationId: string;
  /** The Platform Administrator who raised it — the only one a grant lets read. */
  readonly requesterId: string;
  /** The requester's address, where the reader may see it; `null` for an account since removed. */
  readonly requesterEmail: string | null;
  readonly ticketReference: string;
  /** Written for the organization to read before it answers. */
  readonly reason: string;
  readonly requestedAt: Date;
}

/** A grant, decline or end row, against a request. */
export interface SupportAccessDecisionRecord {
  readonly requestId: string;
  readonly kind: SupportAccessDecisionKind;
  /** A tenant account for the organization's decisions, an admin account for a platform end. */
  readonly actorId: string;
  readonly actorRealm: SupportAccessActorRealm;
  readonly actorEmail: string | null;
  readonly occurredAt: Date;
}

/** One read made under a grant — FR-79's *what was accessed*. */
export interface SupportAccessAccessRecord {
  readonly requestId: string;
  readonly purpose: SupportAccessReadPurpose;
  /** What was opened within that kind of read — a report, or a report and its module. */
  readonly subject: string | null;
  readonly occurredAt: Date;
}

/** A request's rows, as a store hands them to a use case. */
export interface SupportAccessHistory {
  readonly requests: readonly SupportAccessRequestRecord[];
  readonly decisions: readonly SupportAccessDecisionRecord[];
}

/** A request with its state folded from its rows at one instant. */
export interface SupportAccessRequest extends SupportAccessRequestRecord {
  readonly state: SupportAccessState;
  /** When an unanswered request stops waiting — its 24 hours. */
  readonly lapsesAt: Date;
  /** The organization's answer, where one came before the request lapsed. */
  readonly decision: SupportAccessDecisionRecord | null;
  /** When a grant's 60 minutes run out; `null` for a request that was never granted. */
  readonly expiresAt: Date | null;
  /** An end that came while the grant was live. */
  readonly ended: SupportAccessDecisionRecord | null;
}

/** A request as A-07's log shows it (UC-86): its state, the organization's name, and every read made under it. */
export interface SupportAccessLogEntry extends SupportAccessRequest {
  readonly organizationName: string | null;
  readonly accesses: readonly SupportAccessAccessRecord[];
}

export interface SupportAccessLogPage {
  readonly entries: readonly SupportAccessLogEntry[];
  /** Every request ever raised. */
  readonly total: number;
}

/** What the organization is shown (UX-124): requests awaiting an answer, and access running now. */
export interface OrganizationSupportAccess {
  /** Only for an Organization Administrator — the one who answers. Empty for any other member. */
  readonly awaiting: readonly SupportAccessRequest[];
  readonly active: SupportAccessRequest | null;
}
