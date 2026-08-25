import { INVITATION_STATUS, type Invitation } from '../models/invitation.model';

/**
 * Whether an invitation's link is still good — FR-11's "single-use and expiring", decided at the
 * point of use rather than stored (task 26.2).
 *
 * **This file was written during task 26.1 and deleted the same hour**, because nothing in that
 * task consulted the clock: issue, resend, revoke and list all branch on `status` alone. It returns
 * now that acceptance exists, which is the caller it was always for — and it returns with the two
 * predicates split, because 26.2 needs both and needs them to say different things.
 *
 * **Expiry is a fact about the clock; acceptability is a fact about the whole row.** A single
 * function serving both would answer one of them wrongly, and the wrong answer reaches a person: a
 * revoked invitation is not "expired", and telling an invitee their link timed out when an
 * administrator withdrew it is a false statement in the one place NFR-79 requires a true one. S-03
 * draws them as separate recoverable states for exactly that reason.
 *
 * `now` stays an ordinary parameter: nothing adjacent shares its type, so the swap hazard
 * CLAUDE.md names does not exist here (the same reasoning `sessionHasExpired` records).
 */
export function invitationHasExpired(invitation: Pick<Invitation, 'expiresAt'>, now: Date): boolean {
  return invitation.expiresAt.getTime() <= now.getTime();
}

/**
 * Can this invitation still be turned into a membership? UC-15's gate.
 *
 * Deliberately **not** used by the resend path (task 26.1). Resending a lapsed invitation is the
 * whole point of the rotation decision — the token is reminted and the window restarts — which is
 * what makes "they never got round to it" recoverable without revoke-and-reinvite.
 */
export function invitationIsAcceptable(
  invitation: Pick<Invitation, 'status' | 'expiresAt'>,
  now: Date,
): boolean {
  return invitation.status === INVITATION_STATUS.PENDING && !invitationHasExpired(invitation, now);
}
