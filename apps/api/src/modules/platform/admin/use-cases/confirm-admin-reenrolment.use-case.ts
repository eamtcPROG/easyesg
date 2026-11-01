import type { Clock } from '@api/contracts/clock.port';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { verifyTotp } from '../domain/totp';
import {
  AdminReenrolmentCodeInvalidError,
  AdminReenrolmentMissingError,
} from '../errors/admin-credentials.errors';
import type { AdminCredentialStore } from '../interfaces/admin-credential-store.interface';
import { reauthenticateOperator, type OperatorReauthentication } from './reauthenticate-operator';

export interface ConfirmAdminReenrolmentCommand extends OperatorReauthentication {
  /** A current code from the authenticator the staged secret was entered into. */
  readonly code: string;
}

/**
 * UC-212 step two, its second half — the staged factor confirmed and put in force (task 144).
 *
 * **It re-authenticates like every A-19 write** (project owner, 14 Sep 2026). The tenant confirmation
 * takes only a code, which leaves an abandoned staging guessable from a stolen session for as long as it
 * sits; carrying the current password as well means a stolen session alone never completes one, and a
 * wrong code spends the same window a wrong password does.
 *
 * **Read, judged and promoted in one unit of work, under the account row's lock**, so a `begin` landing
 * between the code's check and the promotion cannot put in force a secret the code never proved. A refusal
 * inside it rolls back nothing worth keeping: the window was spent outside, before the password was
 * verified.
 *
 * **Recovery codes and sessions are untouched.** The codes belong to the account, not to the device
 * (§12.5.6's task-144 row), and A-19 discloses a consequence only on the password change.
 */
export class ConfirmAdminReenrolment {
  constructor(
    private readonly store: AdminCredentialStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: ConfirmAdminReenrolmentCommand): Promise<void> {
    await reauthenticateOperator({
      store: this.store,
      hasher: this.hasher,
      now: this.now,
      command,
    });

    await this.store.run(async (tx) => {
      const at = this.now();
      const staged = await tx.findStagedTotpSecretForUpdate(command.accountId);
      if (staged === null) throw new AdminReenrolmentMissingError();
      if (!verifyTotp({ secret: staged, code: command.code }, at)) {
        throw new AdminReenrolmentCodeInvalidError();
      }
      await tx.promoteStagedTotpSecret({ accountId: command.accountId, at });
    });
  }
}
