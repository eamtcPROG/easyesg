import { setupHasLapsed } from '@api/modules/identity/account/domain/account-expiry';
import { passwordMeetsPolicy } from '@api/modules/identity/account/domain/password-policy';
import { hashPasswordResetToken } from '@api/modules/identity/account/domain/password-reset-token';
import { PasswordPolicyViolationError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import { finaliseIssuedSession } from '@api/modules/identity/session/domain/issue-session';
import { mintRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import type { AccessTokenSigner } from '@api/modules/identity/session/interfaces/access-token-signer.interface';
import type { IssuedSession } from '@api/modules/identity/session/models/session.model';
import type { Clock } from '@api/contracts/clock.port';
import {
  AccountSetupNotPendingError,
  FirstPasswordAlreadySetError,
  SetupGrantInvalidError,
} from '../errors/account-setup.errors';
import type { AccountSetupStore } from '../interfaces/account-setup-store.interface';
import { recordFirstPassword } from './record-first-password';

export interface SetFirstPasswordByGrantCommand {
  /** The single-use value `POST /auth/verify-email` answered with. */
  readonly grant: string;
  readonly password: string;
  /**
   * S-01's *Keep me signed in on this device*, asked on this step (§12.5.6's task-155 row (4)). Absent
   * reads as `false`, the shorter lifetime — `SignInRequestDto.remember`'s direction, for its reason.
   */
  readonly remember?: boolean;
}

/**
 * The confirmation link's first password (task 155; §12.5.6's task-155 row (4), UC-03): an account
 * registered through a provider that did not assert the address confirms it by email, and the link it
 * consumed opens the password step for a quarter-hour — **the person is signed in once it is set**, on
 * the lifetime they chose on the step.
 *
 * **The grant is looked up before the password is hashed.** The route is public, so a value naming no
 * live grant is refused for the price of an indexed read rather than an Argon2id derivation. The claim
 * inside the transaction still decides single use, so a grant spent or run out between the two is
 * refused there.
 *
 * **One transaction**: the grant is claimed, the password written, the account activated where its
 * name is already held, every session it held revoked, and the new session created — together or not
 * at all. Every refusal throws inside it, so a refused grant is un-claimed by the rollback; a password
 * outside the policy costs the typing and never the link, since it is checked before anything else.
 *
 * **Only a grant is claimed here, never an emailed reset link** — the token row's `purpose` decides —
 * because this route signs its caller in and a reset never does. **Consuming it ends every session the
 * account already held**, FR-6's rule for a consumed reset token, which the grant is.
 */
export class SetFirstPasswordByGrant {
  constructor(
    private readonly store: AccountSetupStore,
    private readonly hasher: PasswordHasher,
    private readonly signer: AccessTokenSigner,
    private readonly now: Clock,
  ) {}

  async execute(command: SetFirstPasswordByGrantCommand): Promise<IssuedSession> {
    if (!passwordMeetsPolicy(command.password)) throw new PasswordPolicyViolationError();

    const grantHash = hashPasswordResetToken(command.grant);
    const live = await this.store.run((tx) => tx.accountSetupGrantIsLive(grantHash, this.now()));
    if (!live) throw new SetupGrantInvalidError();

    const passwordHash = await this.hasher.hash(command.password);
    const now = this.now();

    const issued = await this.store.run(async (tx) => {
      const claimed = await tx.claimAccountSetupGrant(grantHash, now);
      if (claimed === null || claimed.expiresAt.getTime() <= now.getTime()) {
        throw new SetupGrantInvalidError();
      }

      const state = await tx.findAccountForSetup(claimed.accountId);
      // Past its deadline the account is no account (OQ-52), and its grant proves nothing.
      if (state === null || setupHasLapsed(state.account, now)) throw new SetupGrantInvalidError();
      if (state.account.status !== ACCOUNT_STATUS.AWAITING_SETUP) throw new AccountSetupNotPendingError();
      if (state.passwordSet) throw new FirstPasswordAlreadySetError();

      const recorded = await recordFirstPassword(tx, { state, passwordHash, now });
      await tx.revokeAccountSessions(recorded.account.id, now);

      const minted = mintRefreshToken();
      const session = await tx.createSession({
        accountId: recorded.account.id,
        refreshTokenHash: minted.hash,
        remembered: command.remember ?? false,
        at: now,
      });

      return { account: recorded.account, session, refreshTokenValue: minted.value };
    });

    return finaliseIssuedSession({ ...issued, now }, this.signer);
  }
}
