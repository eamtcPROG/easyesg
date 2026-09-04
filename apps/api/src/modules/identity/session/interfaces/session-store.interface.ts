import type { Account, Credential } from '@api/modules/identity/account/models/account.model';
import type {
  NewSession,
  PresentedRefreshToken,
  Session,
  SessionRevokedReason,
} from '../models/session.model';

/**
 * The `identity/session` store — the same unit-of-work shape as `AccountStore`, which task 19
 * wrote "to be copied". One difference in HOW it is used, and it is the point of this header:
 *
 * **Sign-in runs several short transactions, not one.** Registration wants atomicity — four
 * writes, all or none — so its use case wraps everything in a single `run`. Sign-in wants the
 * opposite for its failure path: a failed attempt must DURABLY count (rate-limit row, lockout
 * increment) while the request still answers 401, and a domain error thrown inside `run` rolls
 * the store transaction back, silently erasing the very counters FR-4 requires. So the sign-in
 * use case returns outcomes from `run` and throws only after the commit. A later author folding
 * it back into one transaction "for consistency" would reintroduce the unlimited-guessing defect
 * without failing a single type check — which is why it is written here, on the port.
 *
 * It reads accounts and credentials through account-module models: sessions depend on accounts
 * the same direction the FK points, and a second copy of those shapes would drift.
 */
export interface SessionTransaction {
  /** Processed attempts for a throttle key since the window start (§12.5.6, approximate by design). */
  countRecentAuthAttempts(key: string, since: Date): Promise<number>;

  /** Records a processed attempt, pruning expired rows opportunistically (see the migration). */
  recordAuthAttempt(key: string, at: Date): Promise<void>;

  findAccountByEmail(email: string): Promise<Account | null>;

  findAccountById(accountId: string): Promise<Account | null>;

  findCredential(accountId: string): Promise<Credential | null>;

  /**
   * Increments `failed_attempts` and sets `locked_at` when the incremented count reaches the
   * threshold — one atomic UPDATE, because two concurrent failures that both read 9 must not
   * both write 10-and-unlocked. The lockout is the exact control behind the approximate limit.
   */
  registerFailedSignIn(accountId: string, threshold: number, at: Date): Promise<void>;

  /** Back to zero on a correct password. Conditional, so the common path writes nothing. */
  clearFailedSignIns(accountId: string): Promise<void>;

  /** Creates the session AND its first refresh token together — a session with no token is dead. */
  createSession(session: NewSession): Promise<Session>;

  /** By hash, flattened with its session's facts. Null when nothing matches. */
  findRefreshToken(tokenHash: Buffer): Promise<PresentedRefreshToken | null>;

  /**
   * Marks the token consumed iff it still is not — the conditional UPDATE that makes rotation
   * single-use under concurrency, exactly as `claimVerificationToken` argues. False means a
   * concurrent refresh won the race.
   */
  consumeRefreshToken(tokenId: string, at: Date): Promise<boolean>;

  /** The rotation's second half, inside the same transaction as the consume. */
  issueRefreshToken(sessionId: string, tokenHash: Buffer, at: Date): Promise<void>;

  revokeSession(sessionId: string, reason: SessionRevokedReason, at: Date): Promise<void>;
}

export interface SessionStore {
  run<T>(work: (tx: SessionTransaction) => Promise<T>): Promise<T>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const SESSION_STORE = Symbol('SESSION_STORE');
