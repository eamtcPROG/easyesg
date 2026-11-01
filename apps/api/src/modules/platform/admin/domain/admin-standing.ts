import { ADMIN_INVITATION_STATUS, type AdminInvitation } from '../models/admin-invitation.model';
import {
  ADMIN_ROSTER_KIND,
  ADMIN_STANDING,
  type AdminRoster,
  type AdminRosterAccount,
  type AdminRosterRow,
  type AdminStanding,
} from '../models/admin-roster.model';
import { ADMIN_ACCOUNT_STATUS } from '../models/admin-session.model';

/**
 * A-08's account table as rows (task 67.4) — each row's one-word state, and where the row sits.
 *
 * **The state is a reading of facts, derived here rather than stored** (`ADMIN_STANDING`'s note).
 * Removal and suspension outrank a lockout: a suspended account that is also locked cannot sign in
 * for the first reason, and a lockout release offered on it would act on the second while the first
 * still refuses.
 *
 * **The order is the artboard's**: the operators who can act, then the invitations on their way,
 * then the removed accounts kept for attribution. Each group keeps the order the store read it in,
 * which is a collation (OQ-61) and so belongs to SQL, not to a JavaScript sort.
 */

/**
 * How far back A-08's support-access column counts (task 67.9): the last 30 days, as A-07's artboard counts
 * *requests in 30 days* (project owner, 14 Sep 2026).
 */
export const SUPPORT_ACCESS_REQUEST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const accountStanding = (account: AdminRosterAccount): AdminStanding => {
  if (account.status === ADMIN_ACCOUNT_STATUS.REMOVED) return ADMIN_STANDING.REMOVED;
  if (account.status === ADMIN_ACCOUNT_STATUS.SUSPENDED) return ADMIN_STANDING.SUSPENDED;
  return account.lockedAt === null ? ADMIN_STANDING.ACTIVE : ADMIN_STANDING.LOCKED;
};

const invitationStanding = (invitation: AdminInvitation, now: Date): AdminStanding =>
  invitation.expiresAt.getTime() <= now.getTime() ? ADMIN_STANDING.LAPSED : ADMIN_STANDING.INVITED;

export const adminRosterRowsOf = (input: {
  readonly roster: AdminRoster;
  readonly now: Date;
  /** Support-access requests per account id in the window; an account absent raised none. */
  readonly supportAccessRequests: ReadonlyMap<string, number>;
}): AdminRosterRow[] => {
  const removed = (account: AdminRosterAccount) => account.status === ADMIN_ACCOUNT_STATUS.REMOVED;

  const accountRow = (account: AdminRosterAccount): AdminRosterRow => ({
    id: account.id,
    kind: ADMIN_ROSTER_KIND.ACCOUNT,
    email: account.email,
    role: account.role,
    standing: accountStanding(account),
    lastSignInAt: account.lastSignInAt,
    expiresAt: null,
    supportAccessRequests: input.supportAccessRequests.get(account.id) ?? 0,
  });

  return [
    ...input.roster.accounts.filter((account) => !removed(account)).map(accountRow),
    ...input.roster.invitations
      // The store reads pending invitations only; an accepted one is its account and a revoked one
      // is nobody, so this states the rule rather than trusting a caller to have applied it.
      .filter((invitation) => invitation.status === ADMIN_INVITATION_STATUS.PENDING)
      .map(
        (invitation): AdminRosterRow => ({
          id: invitation.id,
          kind: ADMIN_ROSTER_KIND.INVITATION,
          email: invitation.email,
          role: invitation.role,
          standing: invitationStanding(invitation, input.now),
          lastSignInAt: null,
          expiresAt: invitation.expiresAt,
          // An invitation is not yet anybody who could have asked.
          supportAccessRequests: null,
        }),
      ),
    ...input.roster.accounts.filter(removed).map(accountRow),
  ];
};
