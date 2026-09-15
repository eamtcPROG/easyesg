import { setupProofIsFresh } from '@api/modules/identity/account/domain/account-setup';
import { passwordMeetsPolicy } from '@api/modules/identity/account/domain/password-policy';
import { PasswordPolicyViolationError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import type { Clock } from '@api/contracts/clock.port';
import {
  AccountSetupNotPendingError,
  FirstPasswordAlreadySetError,
  SetupSessionStaleError,
} from '../errors/account-setup.errors';
import type { AccountSetupStore } from '../interfaces/account-setup-store.interface';
import type { AccountSetupState } from '../models/account-setup.model';
import { recordFirstPassword } from './record-first-password';

export interface SetFirstPasswordCommand {
  readonly accountId: string;
  /**
   * The session this request acts on — its creation instant is the proof. From the request context,
   * never the body: a session id arriving from the wire would let a caller nominate an older one.
   */
  readonly sessionId: string;
  readonly password: string;
}

/**
 * S-36's first step (task 155; §12.5.6's task-155 row (4)): an account in setup sets its first
 * password, on the proof of a provider sign-in no older than a quarter-hour.
 *
 * **Why the session's creation instant is the proof, and not a stand-in for one.** An account holding
 * no password can hold no session but a provider sign-in's — password sign-in needs a credential, and
 * a refresh rotates the token while keeping the session's `created_at`. So the instant the session was
 * created *is* the instant the provider last authenticated this person, which is exactly what there is
 * no current password to ask for instead.
 *
 * The checks run in the order their answers are useful: an account not in setup has nothing to
 * complete, one holding a password has done this step, and only then does the proof's age matter. The
 * password is hashed before the transaction opens, for `RegisterAccount`'s reason — Argon2id is tens of
 * milliseconds by design, and a pooled connection must not idle through it.
 */
export class SetFirstPassword {
  constructor(
    private readonly store: AccountSetupStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: SetFirstPasswordCommand): Promise<AccountSetupState> {
    if (!passwordMeetsPolicy(command.password)) throw new PasswordPolicyViolationError();
    const passwordHash = await this.hasher.hash(command.password);

    return this.store.run(async (tx) => {
      const now = this.now();

      const state = await tx.findAccountForSetup(command.accountId);
      if (state === null) throw new AuthenticationRequiredError();
      if (state.account.status !== ACCOUNT_STATUS.AWAITING_SETUP) throw new AccountSetupNotPendingError();
      if (state.passwordSet) throw new FirstPasswordAlreadySetError();

      const provedAt = await tx.findSessionCreatedAt(command.sessionId);
      if (provedAt === null || !setupProofIsFresh({ provedAt }, now)) {
        throw new SetupSessionStaleError();
      }

      return recordFirstPassword(tx, { state, passwordHash, now });
    });
  }
}
