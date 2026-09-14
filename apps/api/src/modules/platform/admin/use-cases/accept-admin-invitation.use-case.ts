import { passwordMeetsPolicy } from '@easyesg/validation';
import type { Clock } from '@api/contracts/clock.port';
import type { SystemAuditLog } from '@api/contracts/system-audit-log.port';
import { PasswordPolicyViolationError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { AUDIT_ACTION } from '@api/modules/platform/audit/models/audit-action.model';
import { ADMIN_INVITATION_STANDING } from '../domain/admin-invitation-standing';
import { verifyTotp } from '../domain/totp';
import { AdminFactorInvalidError } from '../errors/admin-session.errors';
import {
  AdminEnrolmentMissingError,
  AdminInvitationNotAcceptableError,
} from '../errors/admin-invitation.errors';
import type { AdminInvitationBearerStore } from '../interfaces/admin-invitation-bearer-store.interface';
import {
  presentAdminInvitation,
  type PresentAdminInvitationCommand,
} from './preview-admin-invitation.use-case';

export interface AcceptAdminInvitationCommand extends PresentAdminInvitationCommand {
  readonly password: string;
  /** A current code from the authenticator the staged secret was entered into. */
  readonly totpCode: string;
}

export interface AcceptedAdminInvitation {
  readonly accountId: string;
  readonly email: string;
}

/**
 * A-20's last step (task 67.4; UC-87): the password and a confirming code, and the account exists.
 *
 * **Checked in the order a person's mistakes are cheapest to report**: no staged factor, then the
 * password policy, then the code — and only then the Argon2id hash, which is the expensive part and
 * would otherwise be paid for every mistyped code. **None of those refusals spends the bearer window**:
 * the gate already proved the token live, and a person getting a code wrong is not guessing a link.
 * The code is not the account's second factor yet, so there is no lockout to feed either.
 *
 * **One transaction claims the invitation and writes the account** (`accept`'s contract), so two tabs
 * accepting at once create one account; the loser is told the link is no longer valid, which is true.
 *
 * **It issues no session.** The new operator signs in on A-01, which is the path that records a
 * sign-in and that every other session in the realm came from; a session minted here would be the
 * one that did not.
 *
 * **Audited here, not by `AuditInterceptor`**: this route carries no operator session, and the actor
 * is the account the acceptance just created (§12.5.6's task-67.4 row).
 */
export class AcceptAdminInvitation {
  constructor(
    private readonly store: AdminInvitationBearerStore,
    private readonly hasher: PasswordHasher,
    private readonly audit: SystemAuditLog,
    private readonly now: Clock,
  ) {}

  async execute(command: AcceptAdminInvitationCommand): Promise<AcceptedAdminInvitation> {
    const at = this.now();
    const invitation = await presentAdminInvitation({ store: this.store, command, now: at });

    const secret = invitation.stagedTotpSecret;
    if (secret === null) throw new AdminEnrolmentMissingError();
    if (!passwordMeetsPolicy(command.password)) throw new PasswordPolicyViolationError();
    if (!verifyTotp({ secret, code: command.totpCode }, at)) throw new AdminFactorInvalidError();

    const passwordHash = await this.hasher.hash(command.password);

    const accountId = await this.store.run((tx) =>
      tx.accept({
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role,
        passwordHash,
        totpSecret: secret,
        at,
      }),
    );
    if (accountId === null) {
      throw new AdminInvitationNotAcceptableError(ADMIN_INVITATION_STANDING.UNKNOWN);
    }

    await this.audit.record({
      action: AUDIT_ACTION.ADMIN_INVITATION_ACCEPTED,
      actorId: accountId,
      targetId: invitation.id,
    });

    return { accountId, email: invitation.email };
  }
}
