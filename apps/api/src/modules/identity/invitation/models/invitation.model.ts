import type { Locale } from '@easyesg/i18n';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';

/**
 * The invitation as it crosses the store port — FR-11, FR-57 (task 26.1). Not a TypeORM entity
 * (AD-14 constraint 1), and instants are `Date`: epoch-ms is the wire's representation, converted
 * at the DTO boundary (OQ-50).
 */

/**
 * The role an invitation may assign — the migration's `invitation_role_known` CHECK, which admits
 * **two** values where `membership_role_known` admits three.
 *
 * That narrowing is FR-57 in terms: a user is invited "with an edit or view-only role". Organization
 * Administrator is reached by UC-64's promotion after joining and never by invitation, which is what
 * keeps FR-60's single-administrator rule answerable from the membership table alone — an
 * outstanding invitation is not an administrator and must not be counted as one.
 *
 * **Derived from `MEMBERSHIP_ROLE` rather than restated**, so this is a subset of that vocabulary
 * and the compiler knows it: `InvitedRole` is assignable to `MembershipRole`, which is exactly what
 * task 26.2 needs when it turns an accepted invitation into a membership at the invited role. A
 * hand-written `'editor' | 'viewer'` would compile identically today and drift silently the moment
 * either value is renamed.
 */
export const INVITED_ROLE = {
  EDITOR: MEMBERSHIP_ROLE.EDITOR,
  VIEWER: MEMBERSHIP_ROLE.VIEWER,
} as const;

export type InvitedRole = (typeof INVITED_ROLE)[keyof typeof INVITED_ROLE];

/**
 * Where the invitation is in its life — the `invitation_status_known` CHECK's vocabulary.
 *
 * **`expired` is deliberately not a member.** Expiry is `expiresAt` compared to the clock at the
 * point of use, exactly as AD-12's session lifetimes are (OQ-35): a stored status would need a
 * sweep to maintain, and between sweeps it would be wrong while *looking* authoritative. So a row
 * whose window has passed is still `pending`, and `invitationHasExpired` is what decides whether it
 * can still be accepted.
 *
 * `accepted` is written by task 26.2, not by this task. It is declared here because the vocabulary
 * is this table's design and the partial unique index depends on it being complete — without it,
 * acceptance would have to leave a consumed invitation `pending` and the index would hold the
 * invited address against that organization forever.
 */
export const INVITATION_STATUS = {
  PENDING: 'pending',
  /** UC-15 consumed it. Single-use: the token is spent and the membership exists (task 26.2). */
  ACCEPTED: 'accepted',
  /** UC-61 withdrew it. The row remains, which is what keeps FR-55's trail answerable. */
  REVOKED: 'revoked',
} as const;

export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export interface Invitation {
  readonly id: string;
  readonly organizationId: string;
  /** As typed by the administrator; compared case-insensitively, like `identity.account.email`. */
  readonly invitedEmail: string;
  readonly role: InvitedRole;
  readonly status: InvitationStatus;
  /**
   * The language the invitation email is written in (FR-169), resolved once at issue and re-used by
   * every resend — the invited address's account locale where one exists, the inviting
   * administrator's negotiated locale otherwise (§12.5.6, task 26.1).
   */
  readonly locale: Locale;
  readonly issuedAt: Date;
  /** Seven days from the most recent issue or resend (§12.5.6). Not a status — see above. */
  readonly expiresAt: Date;
  /** Non-null exactly when `status` is `accepted` — the matching CHECK. */
  readonly acceptedAt: Date | null;
  /** Non-null exactly when `status` is `revoked` — the matching CHECK. */
  readonly revokedAt: Date | null;
}

/**
 * One outstanding invitation as S-16 lists it beside the members (FR-56, FR-57).
 *
 * **Narrower than `Invitation` on purpose.** The screen renders "active or pending invitation" as
 * one list, and what it needs of an invitation is who was invited, as what, and how long the link
 * has left. `acceptedAt` and `revokedAt` are both null by construction in a pending row, and
 * `organizationId` is the active tenant — publishing either would be answering a question the
 * caller did not ask with a value they already hold.
 *
 * `expiresAt` travels rather than an `expired` flag, because the screen has a clock and the
 * server's answer would be stale by the time it rendered. It is also what tells the administrator
 * whether to resend now or wait.
 */
export interface PendingInvitation {
  readonly id: string;
  readonly invitedEmail: string;
  readonly role: InvitedRole;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}
