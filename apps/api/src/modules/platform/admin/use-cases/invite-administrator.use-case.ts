import type { Clock } from '@api/contracts/clock.port';
import {
  adminInvitationMailThrottleKey,
  admitAuthAttempt,
} from '@api/modules/identity/account/domain/auth-throttle';
import { emailIdentityKey } from '@api/modules/identity/account/domain/email-address';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { issueAdminInvitationToken } from '../domain/admin-invitation-token';
import { AdminAccountExistsError } from '../errors/admin-accounts.errors';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';
import type { AdminInvitation } from '../models/admin-invitation.model';
import type { AdminRole } from '../models/admin-session.model';

export interface InviteAdministratorCommand {
  readonly email: string;
  /** The realm the account will hold, fixed now — the realms are separate accounts, never changed. */
  readonly role: AdminRole;
  /** The Platform Administrator sending it, from the request context — never the body. */
  readonly invitedBy: string;
}

/**
 * UC-87, the inviting half (task 67.4; §12.5.6's task-67.4 row): a Platform Administrator invites an
 * operator into either realm (`actors.md` OQ-6), and a single-use link valid for 24 hours goes out.
 *
 * **One unit of work, and every refusal inside it rolls back what it wrote** — which is right here
 * for each of them, unlike sign-in's. The window's refusal records nothing by `admitAuthAttempt`'s own
 * rule, and a collision refused after the window admitted the call rolls its attempt row back with
 * it, so it costs no budget: no mail left (task 141's reasoning).
 *
 * **The collision with an account is a read, the collision with an invitation is the index.** An
 * address held by an account that is not removed has no partial index to raise on across two tables,
 * so it is checked here; two simultaneous invitations of one address are the race a read cannot
 * decide, so `admin_invitation_pending_email_key` does, and the adapter raises it as
 * `AdminInvitationOutstandingError`.
 *
 * **Not audited here**: the route declares `admin.invitation.issued`, and `AuditInterceptor` writes it
 * once this returns — naming the invitation this returns as the target (§12.5.6's task-67.4 row).
 */
export class InviteAdministrator {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly now: Clock,
  ) {}

  async execute(command: InviteAdministratorCommand): Promise<AdminInvitation> {
    // Lower-cased: `admin_invitation_email_lowercase` and the account's CHECK both hold the address so.
    const email = emailIdentityKey(command.email);
    const now = this.now();

    return this.store.run(async (tx) => {
      if (!(await admitAuthAttempt(tx, { key: adminInvitationMailThrottleKey(email), now }))) {
        throw new AuthRateLimitedError();
      }

      if (await tx.hasLiveAccountWithEmail(email)) throw new AdminAccountExistsError();

      const token = issueAdminInvitationToken(now);
      const invitation = await tx.issueInvitation({
        email,
        role: command.role,
        invitedBy: command.invitedBy,
        tokenHash: token.hash,
        issuedAt: now,
        expiresAt: token.expiresAt,
      });

      await tx.emitInvitationEmail({
        event: { invitationId: invitation.id, email: invitation.email, token: token.value },
        expiresAt: token.expiresAt,
      });

      return invitation;
    });
  }
}
