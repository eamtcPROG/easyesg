/**
 * Invitation vocabularies (FR-11, FR-57; tasks 26.1–26.3) — the consumer-side declarations of
 * values `apps/api` derives from its own `INVITATION_STANDING` and `MEMBERSHIP_GRANT_KIND`
 * objects.
 *
 * Two copies for `PROBLEM_TYPE`'s stated reason, which `social.ts` restates: the api **produces**
 * this package and must never import it, so this is a mirror changed together with its source by
 * hand — and the OpenAPI enums generated from the api's copy are what the diff gate holds both
 * against. A drift here is a failing `openapi:check`, not a silent divergence.
 *
 * The generated types already give the unions; what these add is the **runtime** values, which is
 * what a screen branching on a standing actually needs. Comparing against a bare literal is the
 * failure CLAUDE.md's closed-vocabulary rule names, and one of the two `no-restricted-syntax`
 * selectors catches it.
 */

/**
 * Whether an invitation link can still be used, and if not, why — `POST /invitations/preview`'s
 * answer and the `standing` member of an `invitation-not-acceptable` problem document.
 *
 * **Four ways of saying no rather than one**, because `design_spec.md` S-03 draws them as separate
 * recoverable states: each has its own resolution — ask for a resend, sign in, ask to be invited
 * again, check the link — and a screen cannot branch on wording.
 */
export const INVITATION_STANDING = {
  /** Pending and inside its window. The only value acceptance proceeds from. */
  ACCEPTABLE: 'acceptable',
  /** Pending, past its expiry. An administrator can resend it, which mints a fresh link. */
  EXPIRED: 'expired',
  /** Already accepted. Single-use is FR-11's word, and this is what a second click sees. */
  CONSUMED: 'consumed',
  /** Withdrawn by an administrator (UC-61) — FR-57's "immediately", from the invitee's side. */
  REVOKED: 'revoked',
  /** No invitation carries this token: mistyped, truncated by a mail client, or never issued. */
  UNKNOWN: 'unknown',
} as const;

export type InvitationStanding = (typeof INVITATION_STANDING)[keyof typeof INVITATION_STANDING];

export const isInvitationStanding = (value: string): value is InvitationStanding =>
  (Object.values(INVITATION_STANDING) as string[]).includes(value);

/**
 * What accepting actually did — `POST /invitations/acceptance`'s `grant`.
 *
 * Published rather than hidden so the screen can say the true thing: joined, rejoined, or "you
 * already had access". Three sentences, and NFR-79 wants the one that happened.
 */
export const MEMBERSHIP_GRANT_KIND = {
  CREATED: 'created',
  /** A member removed under FR-59 and later re-invited — one row per pair ever (task 25.1). */
  REACTIVATED: 'reactivated',
  /** Access already stood; the invitation is spent and the role they hold is untouched. */
  ALREADY_MEMBER: 'already_member',
} as const;

export type MembershipGrantKind =
  (typeof MEMBERSHIP_GRANT_KIND)[keyof typeof MEMBERSHIP_GRANT_KIND];
