import type { Clock } from '@api/contracts/clock.port';
import {
  adminInvitationMailThrottleKey,
  admitAuthAttempt,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { issueAdminInvitationToken } from '../domain/admin-invitation-token';
import { AdminInvitationNotFoundError } from '../errors/admin-invitation.errors';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';
import { ADMIN_INVITATION_STATUS } from '../models/admin-invitation.model';

export interface ResendAdminInvitationCommand {
  readonly invitationId: string;
}

/**
 * A-08's resend (task 67.4): **a new link, the old one dead**, the 24 hours restarted on the same row —
 * task 26.1's *one live link per invitation, ever*, over the admin realm.
 *
 * **A lapsed invitation is resent, not refused**: that is what makes "they did not get to it in a day"
 * recoverable without a revoke and a second invitation, and the 24-hour lifetime tolerable. The staged
 * secret goes with the old token (`reissueInvitationToken`'s contract), so whoever held the replaced
 * link cannot have enrolled a factor the new link's bearer would inherit.
 *
 * It spends the same window the issue does, keyed on the address — the mailbox is what is rationed.
 */
export class ResendAdminInvitation {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: ResendAdminInvitationCommand): Promise<void> {
    const now = this.now();

    await this.store.run(async (tx) => {
      const invitation = await tx.findInvitation(command.invitationId);
      if (invitation === null || invitation.status !== ADMIN_INVITATION_STATUS.PENDING) {
        throw new AdminInvitationNotFoundError();
      }

      if (
        !(await admitAuthAttempt(tx, { key: adminInvitationMailThrottleKey(invitation.email), now }))
      ) {
        throw new AuthRateLimitedError();
      }

      const token = issueAdminInvitationToken(now);
      const reissued = await tx.reissueInvitationToken({
        invitationId: invitation.id,
        tokenHash: token.hash,
        issuedAt: now,
        expiresAt: token.expiresAt,
      });
      // Accepted or revoked between the read and the write — the same answer the read would have given.
      if (!reissued) throw new AdminInvitationNotFoundError();

      await tx.emitInvitationEmail({
        event: { invitationId: invitation.id, email: invitation.email, token: token.value },
        expiresAt: token.expiresAt,
      });
    });
  }
}
