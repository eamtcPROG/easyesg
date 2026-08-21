import { unverifiedAccountHasExpired } from '@api/modules/identity/account/domain/account-expiry';
import {
  AUTH_ATTEMPT_LIMIT,
  AUTH_ATTEMPT_WINDOW_MS,
  LOCKOUT_THRESHOLD,
  signInThrottleKey,
} from '@api/modules/identity/account/domain/auth-throttle';
import { normaliseEmail } from '@api/modules/identity/account/domain/email-address';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import {
  ACCOUNT_STATUS,
  type Account,
  type Credential,
} from '@api/modules/identity/account/models/account.model';
import { mintRefreshToken } from '../domain/refresh-token';
import { ACCESS_TOKEN_TTL_MS, sessionExpiresAt } from '../domain/session-expiry';
import {
  AccountLockedError,
  CredentialInvalidError,
  EmailUnverifiedError,
} from '../errors/session.errors';
import type { AccessTokenSigner } from '../interfaces/access-token-signer.interface';
import type { SessionStore, SessionTransaction } from '../interfaces/session-store.interface';
import type { IssuedSession } from '../models/session.model';
import type { Clock } from '@api/contracts/clock.port';

export interface SignInCommand {
  readonly email: string;
  readonly password: string;
  /** For §12.5.6's per-(IP, account) window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/**
 * UC-04 — log in with email and password (FR-4).
 *
 * Framework-free, constructed by `useFactory` like every use case here. Two structural choices
 * carry the requirement and are worth reading before editing:
 *
 * **Several short transactions, not one** — the inversion of `RegisterAccount`'s single-`run`
 * shape, and the store's header explains why: a failed attempt must durably count against the
 * throttle window and the lockout while the request answers 401, and a throw inside `run` would
 * roll those counters back. So every `run` below returns an outcome, and every throw happens
 * after the commit. The cost is that the fetched account can go stale between transactions; every
 * consequence of that staleness is a counter registered against an account mid-deletion, which is
 * harmless, unlike the alternative.
 *
 * **One uniform failure, timed alike** (NFR-64). Unknown address, wrong password, and a
 * provider-only or expired-unverified record all end in the same `CredentialInvalidError` — and
 * the unknown-address path still burns a real Argon2id verification against a cached dummy hash,
 * because at §9.1's parameters the hash IS the response time, and skipping it would let a
 * stopwatch distinguish "no account" from "wrong password" across the uniform body. The two
 * distinct answers are earned, not leaked: `AccountLockedError` only ever follows ten consecutive
 * failures against a real credential, and `EmailUnverifiedError` requires the correct password
 * (OQ-57) — it also resets the failure count, because a correct password ends any consecutive
 * run FR-4 counts.
 *
 * The lockout check precedes password verification on purpose: a locked credential is not
 * verified at all, so the lock also ends the oracle — ten failures buy an attacker a state where
 * further guesses return `AccountLockedError` regardless of correctness, which teaches nothing.
 */
export class SignIn {
  private dummyHash?: string;

  constructor(
    private readonly store: SessionStore,
    private readonly hasher: PasswordHasher,
    private readonly signer: AccessTokenSigner,
    private readonly now: Clock,
  ) {}

  async execute(command: SignInCommand): Promise<IssuedSession> {
    const email = normaliseEmail(command.email);
    const now = this.now();

    const gate = await this.store.run((tx) => this.admitAttempt(tx, command.clientIp, email, now));
    if (gate.limited) throw new AuthRateLimitedError();

    // OQ-52: an unverified account past its 7-day window has stopped holding the address, so it
    // behaves exactly like no account — enforced at the point of use, as task 19 established.
    const expired =
      gate.account !== null &&
      gate.account.status === ACCOUNT_STATUS.UNVERIFIED &&
      unverifiedAccountHasExpired(gate.account, now);
    const account = expired ? null : gate.account;
    const credential = expired ? null : gate.credential;

    if (credential?.lockedAt) throw new AccountLockedError();

    const matches =
      account !== null && credential !== null
        ? await this.hasher.verify({ digest: credential.passwordHash, password: command.password })
        : await this.burnVerificationTime(command.password);

    if (account === null || credential === null || !matches) {
      if (account !== null && credential !== null) {
        await this.store.run((tx) => tx.registerFailedSignIn(account.id, LOCKOUT_THRESHOLD, now));
      }
      throw new CredentialInvalidError();
    }

    if (account.status === ACCOUNT_STATUS.UNVERIFIED) {
      await this.store.run((tx) => tx.clearFailedSignIns(account.id));
      throw new EmailUnverifiedError();
    }

    const minted = mintRefreshToken();
    const session = await this.store.run(async (tx) => {
      await tx.clearFailedSignIns(account.id);
      return tx.createSession(account.id, minted.hash, now);
    });

    const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
    return {
      account,
      sessionId: session.id,
      accessToken: await this.signer.sign(session.id, accessTokenExpiresAt),
      accessTokenExpiresAt,
      refreshToken: minted.value,
      refreshTokenExpiresAt: sessionExpiresAt({ sessionCreatedAt: session.createdAt, tokenIssuedAt: now }),
    };
  }

  /**
   * The throttle decision and the lookups, in one committed transaction: refuse beyond the
   * window's limit without recording (a refused attempt must not extend the block), record and
   * fetch otherwise.
   */
  private async admitAttempt(
    tx: SessionTransaction,
    clientIp: string | undefined,
    email: string,
    now: Date,
  ): Promise<
    | { limited: true; account?: never; credential?: never }
    | { limited: false; account: Account | null; credential: Credential | null }
  > {
    const key = signInThrottleKey(clientIp, email);
    const since = new Date(now.getTime() - AUTH_ATTEMPT_WINDOW_MS);
    if ((await tx.countRecentAuthAttempts(key, since)) >= AUTH_ATTEMPT_LIMIT) {
      return { limited: true };
    }
    await tx.recordAuthAttempt(key, now);

    const account = await tx.findAccountByEmail(email);
    const credential = account === null ? null : await tx.findCredential(account.id);
    return { limited: false, account, credential };
  }

  /**
   * A real verification against a hash of nothing anyone can type (it is minted from this
   * process's own entropy at first use), so the no-credential paths cost what the
   * wrong-password path costs. Lazy because §9.1's parameters make hashing expensive by design
   * — construction must not pay it, and the first unknown-address attempt may.
   */
  private async burnVerificationTime(password: string): Promise<false> {
    this.dummyHash ??= await this.hasher.hash(mintRefreshToken().value);
    await this.hasher.verify({ digest: this.dummyHash, password });
    return false;
  }
}
