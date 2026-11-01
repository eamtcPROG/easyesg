import { ADMIN_INVITATION_STATUS, type AdminInvitation } from '../models/admin-invitation.model';

/**
 * Whether a presented link can still become an account, and if not, what happened to it (task 67.4;
 * A-20's *not acceptable* state).
 *
 * **One reading per cause, because each is a different sentence to the invitee**: a link that timed
 * out, one an administrator withdrew and one already used are three facts, and A-20 states which
 * rather than a single "invalid link" — S-03's rule for the tenant kind. **`UNKNOWN` covers both a
 * token never issued and one a resend replaced**: the old hash is gone once a resend rotates it, so
 * the two are indistinguishable here and the sentence has to be true of both.
 *
 * Decided at the point of use from the clock, never stored — the tenant invitation's reasoning.
 */
export const ADMIN_INVITATION_STANDING = {
  ACCEPTABLE: 'acceptable',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  ACCEPTED: 'accepted',
  UNKNOWN: 'unknown',
} as const;

export type AdminInvitationStanding =
  (typeof ADMIN_INVITATION_STANDING)[keyof typeof ADMIN_INVITATION_STANDING];

export type UnacceptableAdminInvitationStanding = Exclude<
  AdminInvitationStanding,
  typeof ADMIN_INVITATION_STANDING.ACCEPTABLE
>;

export const adminInvitationStandingOf = (
  invitation: Pick<AdminInvitation, 'status' | 'expiresAt'> | null,
  now: Date,
): AdminInvitationStanding => {
  if (invitation === null) return ADMIN_INVITATION_STANDING.UNKNOWN;
  if (invitation.status === ADMIN_INVITATION_STATUS.ACCEPTED) return ADMIN_INVITATION_STANDING.ACCEPTED;
  if (invitation.status === ADMIN_INVITATION_STATUS.REVOKED) return ADMIN_INVITATION_STANDING.REVOKED;
  return invitation.expiresAt.getTime() <= now.getTime()
    ? ADMIN_INVITATION_STANDING.EXPIRED
    : ADMIN_INVITATION_STANDING.ACCEPTABLE;
};
