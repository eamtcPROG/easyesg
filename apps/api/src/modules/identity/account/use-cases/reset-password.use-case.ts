import { hashPasswordResetToken } from '../domain/password-reset-token';
import { passwordMeetsPolicy } from '../domain/password-policy';
import {
  PasswordPolicyViolationError,
  ResetTokenInvalidError,
} from '../errors/account.errors';
import type { AccountStore } from '../interfaces/account-store.interface';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import type { Clock } from '@api/contracts/clock.port';

export interface ResetPasswordCommand {
  readonly token: string;
  readonly password: string;
}

/**
 * UC-09 — set a new password via reset link (FR-6).
 *
 * One transaction, deliberately — this is `RegisterAccount`'s atomicity case, not sign-in's
 * durable-failure case. Consuming the link does three things and FR-6 is only satisfied by all
 * of them together: the credential is replaced, the lockout is released (§12.5.6 names the
 * consumed link as a release), and **every session for the account is revoked** — the
 * requirement's teeth, because "a compromised session must not survive a reset". A crash between
 * any two of those would leave a state no document describes; the transaction makes it
 * unrepresentable. The rollback-on-throw also un-claims the token on the expired path, which is
 * harmless for the reason `claimVerificationToken` gives: an expired token can never succeed,
 * however often it is presented.
 *
 * Every way the token can be dead — never issued, consumed, expired, superseded by a newer
 * request, or belonging to an account with no password credential — collapses into one
 * `ResetTokenInvalidError`, and the policy check runs BEFORE the claim so a rejected password
 * costs the user their typing, not their link.
 *
 * The password is hashed before the transaction opens, for `RegisterAccount`'s stated reason:
 * Argon2id is tens of milliseconds by design, and a pooled connection must not idle through it.
 */
export class ResetPassword {
  constructor(
    private readonly store: AccountStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    if (!passwordMeetsPolicy(command.password)) throw new PasswordPolicyViolationError();

    const passwordHash = await this.hasher.hash(command.password);
    const tokenHash = hashPasswordResetToken(command.token);

    await this.store.run(async (tx) => {
      const now = this.now();

      const claimed = await tx.claimPasswordResetToken(tokenHash, now);
      if (claimed === null || claimed.expiresAt.getTime() <= now.getTime()) {
        throw new ResetTokenInvalidError();
      }

      if (!(await tx.replaceCredentialPassword(claimed.accountId, passwordHash, now))) {
        throw new ResetTokenInvalidError();
      }

      await tx.revokeAllSessionsForPasswordReset(claimed.accountId, now);
    });
  }
}
