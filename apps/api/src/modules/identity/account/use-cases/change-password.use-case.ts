import type { Clock } from '@api/contracts/clock.port';
import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  reauthenticationThrottleKey,
} from '../domain/auth-throttle';
import { passwordMeetsPolicy } from '../domain/password-policy';
import {
  AuthRateLimitedError,
  PasswordPolicyViolationError,
  ReauthenticationFailedError,
} from '../errors/account.errors';
import type { AccountStore } from '../interfaces/account-store.interface';
import type { PasswordHasher } from '../interfaces/password-hasher.interface';

export interface ChangePasswordCommand {
  readonly accountId: string;
  /** The session this request is acting on — spared by the termination (FR-7's "other"). */
  readonly sessionId: string;
  readonly currentPassword: string;
  readonly password: string;
  /**
   * FR-7's election. **Opt-in**, because the requirement says *where the user elects it* — not
   * defaulted on, which would make a routine password change sign someone out of their phone
   * without their having asked.
   */
  readonly terminateOtherSessions: boolean;
  /** For §12.5.6's re-authentication window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

export interface PasswordChanged {
  /** How many other sessions were ended. Zero is a normal answer and the screen must say so. */
  readonly otherSessionsTerminated: number;
}

/**
 * UC-10 — change own password (FR-7).
 *
 * **Distinct from UC-09's reset in the one way that shapes the whole use case:** the actor is
 * authenticated. There is no token to claim, the account is known before anything is verified, and
 * the *current* password is the credential rather than a link. `ResetPassword` therefore cannot be
 * reused, and the pieces that are shared — the policy, the hasher, the credential replacement —
 * are shared as functions rather than by calling it.
 *
 * **Several short transactions, not one** — `SignIn`'s shape and for its reason: a refused attempt
 * must durably count against §12.5.6's window while the request answers 403, and a throw inside a
 * single `run` would roll back the row the window rests on.
 *
 * **The policy is checked before anything else**, so a rejected new password costs the user their
 * typing and not an attempt against their own throttle — the ordering `ResetPassword` already
 * takes for the same reason.
 *
 * **The current session is spared even when the user elects termination.** "Other active sessions"
 * means the device they are standing on keeps working; revoking it would sign them out of the
 * screen they just changed their password from, which reads as the change having failed. That is
 * why this takes a `sessionId` and `ResetPassword` does not — there, by definition, the actor holds
 * no session.
 *
 * What it deliberately does **not** do is touch FR-4's lockout. The caller has proved possession of
 * a session; a mistyped current password must not be able to sign them out of every device, which
 * is exactly what feeding the lockout would do.
 */
export class ChangePassword {
  constructor(
    private readonly store: AccountStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<PasswordChanged> {
    if (!passwordMeetsPolicy(command.password)) throw new PasswordPolicyViolationError();

    const key = reauthenticationThrottleKey(command.clientIp, command.accountId);
    const limited = await this.store.run(async (tx) => {
      const now = this.now();
      const recent = await tx.countRecentAuthAttempts(
        key,
        new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS),
      );
      await tx.recordAuthAttempt(key, now);
      return recent >= AUTH_ATTEMPT_LIMIT;
    });
    if (limited) throw new AuthRateLimitedError();

    const credential = await this.store.run((tx) => tx.findCredential(command.accountId));
    // A provider-only account (FR-2) holds no credential row and so has no current password to
    // supply. It is refused rather than allowed to set one: FR-7 is a *change*, and creating a
    // first password for a provider account is FR-8's territory — task 27.6 — where the rule that
    // makes it safe (never remove the last credential) actually lives.
    if (credential === null) throw new ReauthenticationFailedError();

    // Hashed outside the transaction, and verified outside it, for `RegisterAccount`'s stated
    // reason: Argon2id is tens of milliseconds by design and a pooled connection must not idle
    // through it. Two of them here, which is the cost of the requirement rather than a slip.
    const matches = await this.hasher.verify({
      digest: credential.passwordHash,
      password: command.currentPassword,
    });
    if (!matches) throw new ReauthenticationFailedError();

    const passwordHash = await this.hasher.hash(command.password);

    return this.store.run(async (tx) => {
      const now = this.now();
      // Replacing the credential also clears the lockout — §12.5.6 makes that inseparable from a
      // password replacement, and it costs nothing here, where an authenticated caller was never
      // locked out to begin with.
      await tx.replaceCredentialPassword({ accountId: command.accountId, passwordHash }, now);

      if (!command.terminateOtherSessions) return { otherSessionsTerminated: 0 };

      // In the same transaction as the replacement: a crash between the two would leave the new
      // password live and the old sessions alive, which is precisely the state the election exists
      // to prevent.
      const terminated = await tx.revokeOtherSessionsForPasswordChange(
        { accountId: command.accountId, exceptSessionId: command.sessionId },
        now,
      );
      return { otherSessionsTerminated: terminated };
    });
  }
}
