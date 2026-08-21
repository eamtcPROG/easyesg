import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  LOCKOUT_THRESHOLD,
  adminSignInThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { normaliseEmail } from '@api/modules/identity/account/domain/email-address';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { mintRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import {
  ADMIN_ACCESS_TOKEN_TTL_MS,
  adminSessionExpiresAt,
} from '../domain/admin-session-expiry';
import { verifyTotp } from '../domain/totp';
import {
  AdminAccountLockedError,
  AdminCredentialInvalidError,
  AdminFactorInvalidError,
} from '../errors/admin-session.errors';
import type { AdminSessionStore, AdminSessionTransaction } from '../interfaces/admin-session-store.interface';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import type { AdminAccount, IssuedAdminSession } from '../models/admin-session.model';
import type { Clock } from '@api/contracts/clock.port';

export interface SignInAdminCommand {
  readonly email: string;
  readonly password: string;
  readonly totpCode: string;
  /** For §12.5.6's per-(IP, account) window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/**
 * UC-68 — log in with elevated privileges (FR-75; task 23).
 *
 * `SignIn`'s structure with one more rung: several short transactions so failures count durably
 * while the request answers 401 (the store header carries the argument), the uniform
 * `AdminCredentialInvalidError` timed alike by burning a real Argon2id verification on the
 * no-account paths, the lockout check ahead of verification so a locked credential ends the
 * oracle — and then the factor. The TOTP check runs strictly AFTER the password succeeds, and
 * its failure both counts toward the same lockout (or a known password buys an unbounded
 * code-guessing budget) and answers distinctly (`factor-invalid`): A-01 names "failed factor"
 * as its own recoverable state, and the disclosure costs nothing — whoever sees it has already
 * proven the password.
 *
 * What this realm deliberately lacks, versus the tenant flow: no unverified state (accounts are
 * provisioned, UC-87), no reset-releases-lock (the realm has no reset; §12.5.6's task-23
 * paragraph names the CLI and task 67's PA action as the releases).
 */
export class SignInAdmin {
  private dummyHash?: string;

  constructor(
    private readonly store: AdminSessionStore,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AdminTokens,
    private readonly now: Clock,
  ) {}

  async execute(command: SignInAdminCommand): Promise<IssuedAdminSession> {
    const email = normaliseEmail(command.email);
    const now = this.now();

    const gate = await this.store.run((tx) => this.admitAttempt(tx, command.clientIp, email, now));
    if (gate.limited) throw new AuthRateLimitedError();
    const account = gate.account;

    if (account?.lockedAt) throw new AdminAccountLockedError();

    const passwordMatches =
      account !== null
        ? await this.hasher.verify({ digest: account.passwordHash, password: command.password })
        : await this.burnVerificationTime(command.password);

    if (account === null || !passwordMatches) {
      if (account !== null) {
        await this.store.run((tx) => tx.registerFailedSignIn(account.id, LOCKOUT_THRESHOLD, now));
      }
      throw new AdminCredentialInvalidError();
    }

    if (!verifyTotp({ secret: account.totpSecret, code: command.totpCode }, now)) {
      await this.store.run((tx) => tx.registerFailedSignIn(account.id, LOCKOUT_THRESHOLD, now));
      throw new AdminFactorInvalidError();
    }

    const minted = mintRefreshToken();
    const session = await this.store.run(async (tx) => {
      await tx.clearFailedSignIns(account.id);
      return tx.createSession(account.id, minted.hash, now);
    });

    const accessTokenExpiresAt = new Date(now.getTime() + ADMIN_ACCESS_TOKEN_TTL_MS);
    return {
      identity: { id: account.id, email: account.email, role: account.role },
      sessionId: session.id,
      accessToken: await this.tokens.sign(session.id, accessTokenExpiresAt),
      accessTokenExpiresAt,
      refreshToken: minted.value,
      refreshTokenExpiresAt: adminSessionExpiresAt({
        sessionCreatedAt: session.createdAt,
        tokenIssuedAt: now,
      }),
    };
  }

  private async admitAttempt(
    tx: AdminSessionTransaction,
    clientIp: string | undefined,
    email: string,
    now: Date,
  ): Promise<
    | { limited: true; account?: never }
    | { limited: false; account: AdminAccount | null }
  > {
    const key = adminSignInThrottleKey(clientIp, email);
    const since = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
    if ((await tx.countRecentAuthAttempts(key, since)) >= AUTH_ATTEMPT_LIMIT) {
      return { limited: true };
    }
    await tx.recordAuthAttempt(key, now);
    return { limited: false, account: await tx.findAdminAccountByEmail(email) };
  }

  /** See `SignIn.burnVerificationTime` — the hash IS the response time (NFR-64). */
  private async burnVerificationTime(password: string): Promise<false> {
    this.dummyHash ??= await this.hasher.hash(mintRefreshToken().value);
    await this.hasher.verify({ digest: this.dummyHash, password });
    return false;
  }
}
