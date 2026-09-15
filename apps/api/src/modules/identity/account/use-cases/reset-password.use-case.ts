import { accountHasLapsed } from '../domain/account-expiry';
import { setupIsComplete } from '../domain/account-setup';
import { hashPasswordResetToken } from '../domain/password-reset-token';
import { passwordMeetsPolicy } from '../domain/password-policy';
import {
  PasswordPolicyViolationError,
  ResetTokenInvalidError,
} from '../errors/account.errors';
import type { AccountStore } from '../interfaces/account-store.interface';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';
import { ACCOUNT_STATUS } from '../models/account.model';
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
 * request, or naming an account abandoned past its window — collapses into one
 * `ResetTokenInvalidError`, and the policy check runs BEFORE the claim so a rejected password costs
 * the user their typing, not their link.
 *
 * **An account holding no password is not a dead token since task 67.11.** A social-only account
 * (FR-2) consuming its link gains its first password — UC-09's alternate flow, which this use case
 * used to refuse — and that is the way back for an account whose only provider an operator disabled
 * on A-18. UC-08 was amended to send such an account the same link rather than direct it to its
 * provider, which after a disable would be a dead end.
 *
 * **Since task 155 that account is in setup, and the reset sets the password half of it**
 * (§12.5.6's task-155 row). One that already holds both name parts is complete and becomes active
 * here; one that does not keeps its setup, and S-36 asks for the name at its next sign-in.
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

    // Looked up before the password is hashed (task 155): the route is public, so a value naming no
    // live link costs an indexed read, never an Argon2id derivation. The claim below decides single use.
    const tokenHash = hashPasswordResetToken(command.token);
    const live = await this.store.run((tx) => tx.passwordResetTokenIsLive(tokenHash, this.now()));
    if (!live) throw new ResetTokenInvalidError();

    const passwordHash = await this.hasher.hash(command.password);

    await this.store.run(async (tx) => {
      const now = this.now();

      const claimed = await tx.claimPasswordResetToken(tokenHash, now);
      if (claimed === null || claimed.expiresAt.getTime() <= now.getTime()) {
        throw new ResetTokenInvalidError();
      }

      const account = await tx.findAccountById(claimed.accountId);
      // A link issued before an abandoned setup's deadline and consumed after it names no account
      // (OQ-52, task 155); the cascade makes a missing one unreachable, and this narrows the type.
      if (account === null || accountHasLapsed(account, now)) throw new ResetTokenInvalidError();

      await tx.setCredentialPassword({ accountId: account.id, passwordHash }, now);
      await tx.revokeAllSessionsForPasswordReset(account.id, now);

      if (
        account.status === ACCOUNT_STATUS.AWAITING_SETUP &&
        setupIsComplete({
          hasPassword: true,
          givenName: account.givenName,
          familyName: account.familyName,
        })
      ) {
        await tx.activateAccount(account.id, now);
      }
    });
  }
}
