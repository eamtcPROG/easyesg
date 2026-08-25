import { INVITATION_STATUS, type Invitation } from '../models/invitation.model';
import { invitationHasExpired } from './invitation-expiry';

/**
 * Why an invitation cannot be accepted, or that it can — the vocabulary S-03 renders (task 26.2).
 *
 * `design_spec.md` S-03 lists "error — recoverable (invitation **expired**, **already used**,
 * **revoked**)" as three distinct states, so the screen has to tell them apart and the API has to
 * say which. That is the whole reason this is a closed vocabulary rather than a boolean: a single
 * "not valid" would collapse three sentences with three different resolutions into one that
 * resolves nothing, which is what NFR-79 forbids.
 *
 * **It discloses nothing to anyone who is not holding the link.** Every value below is reachable
 * only by presenting the token, and the token was emailed to the person the invitation names —
 * so the reader already knows an invitation existed. NFR-64's uniform-response clause is about
 * *account enumeration* on FR-4, FR-6 and FR-11's paths, and none of these values says anything
 * about whether an account exists.
 *
 * **`UNKNOWN` is what a token that matches no row gets**, and it is deliberately not called
 * "not found": the three other values are also, from the bearer's point of view, ways of not
 * finding a usable invitation, and naming this one after the database's answer would invite a
 * screen to treat it as a technical failure rather than as the spent or mistyped link it is.
 */
export const INVITATION_STANDING = {
  /** Pending and inside its window — the only value acceptance proceeds from. */
  ACCEPTABLE: 'acceptable',
  /** Pending, past `expiresAt`. Resolvable: the administrator can resend it (UC-61). */
  EXPIRED: 'expired',
  /** Already consumed. Single-use is FR-11's word, and this is what the second click sees. */
  CONSUMED: 'consumed',
  /** Withdrawn by an administrator (UC-61). FR-57's "immediately", from the invitee's side. */
  REVOKED: 'revoked',
  /** No row carries this token — mistyped, truncated by a mail client, or never issued. */
  UNKNOWN: 'unknown',
} as const;

export type InvitationStanding = (typeof INVITATION_STANDING)[keyof typeof INVITATION_STANDING];

/**
 * The one place a row plus a clock becomes one of the five values.
 *
 * A pure function over `Invitation | null` rather than a method, so every branch is a line of spec
 * with no database — and so the preview and the acceptance cannot disagree about what a given row
 * means. They answer differently (one renders, one refuses), but from the same verdict.
 */
export function invitationStanding(invitation: Invitation | null, now: Date): InvitationStanding {
  if (invitation === null) return INVITATION_STANDING.UNKNOWN;

  // Status first, then the clock. The order matters and is not arbitrary: a revoked invitation
  // whose window has also passed is REVOKED, because that is what happened to it — reporting it as
  // expired would tell the invitee to ask for a resend of something an administrator deliberately
  // withdrew.
  if (invitation.status === INVITATION_STATUS.ACCEPTED) return INVITATION_STANDING.CONSUMED;
  if (invitation.status === INVITATION_STATUS.REVOKED) return INVITATION_STANDING.REVOKED;

  return invitationHasExpired(invitation, now)
    ? INVITATION_STANDING.EXPIRED
    : INVITATION_STANDING.ACCEPTABLE;
}

/**
 * The four values that mean "this link cannot be used" — derived, never listed.
 *
 * It exists so the refusal cannot be constructed with `acceptable`, which is not a refusal and has
 * no sentence to show. Typing the error's parameter as this union makes that unrepresentable rather
 * than merely unlikely, and it keeps the message catalogue honest in both directions: every value
 * here needs wording, and no value here is wording nobody can reach.
 *
 * Derived by exclusion so a fifth reason added to `INVITATION_STANDING` lands here automatically
 * and the spec that walks these keys fails until it is written — the alternative being a hand-kept
 * second list that stays green while a problem document ships with no `detail` at all.
 */
export type UnacceptableStanding = Exclude<
  InvitationStanding,
  typeof INVITATION_STANDING.ACCEPTABLE
>;

export const UNACCEPTABLE_STANDINGS: readonly UnacceptableStanding[] = Object.values(
  INVITATION_STANDING,
).filter((standing): standing is UnacceptableStanding => standing !== INVITATION_STANDING.ACCEPTABLE);
