import type {
  AdminAccount,
  AdminSession,
  AdminSessionRevokedReason,
  PresentedAdminRefreshToken,
} from '../models/admin-session.model';

/**
 * The admin realm's store — `SessionStore`'s unit-of-work shape over the admin tables, and its
 * usage rule travels with it: **sign-in runs several short transactions and throws only after
 * the commit**, because a failed attempt must durably count against §12.5.6's throttle and
 * lockout while the request answers 401. The tenant port's header carries the full argument;
 * folding the flow back into one `run` reintroduces unlimited guessing without failing a check.
 *
 * Deliberately NOT the tenant `SessionStore` with a realm column: NFR-65's "shares no session"
 * is enforced by these being different tables behind a different port, so no query can quietly
 * join the realms.
 */
export interface AdminSessionTransaction {
  /** §12.5.6's shared throttle substrate (`identity.auth_attempt`) — admin keys carry their own
   *  path prefix (`auth-throttle.ts`), so neither realm spends the other's window. */
  countRecentAuthAttempts(key: string, since: Date): Promise<number>;

  recordAuthAttempt(key: string, at: Date): Promise<void>;

  /** Active accounts only — a deactivated operator (FR-80) reads as no account at all. */
  findAdminAccountByEmail(email: string): Promise<AdminAccount | null>;

  /** Active only, like the email lookup — rotation re-reads through this, so a deactivation
   *  refuses the next rotation even before task 28's per-request guard exists. */
  findAdminAccountById(accountId: string): Promise<AdminAccount | null>;

  /** Increments `failed_attempts`, locking at the threshold in one atomic UPDATE. Counts both
   *  password and TOTP failures: the lockout must cover the factor, or ten known-password
   *  attackers get an unbounded code-guessing budget. */
  registerFailedSignIn(accountId: string, threshold: number, at: Date): Promise<void>;

  clearFailedSignIns(accountId: string): Promise<void>;

  /** Creates the session AND its first refresh token together — a session with no token is dead. */
  createSession(accountId: string, refreshTokenHash: Buffer, at: Date): Promise<AdminSession>;

  findRefreshToken(tokenHash: Buffer): Promise<PresentedAdminRefreshToken | null>;

  /** The conditional consume that decides rotation races exactly once. */
  consumeRefreshToken(tokenId: string, at: Date): Promise<boolean>;

  issueRefreshToken(sessionId: string, tokenHash: Buffer, at: Date): Promise<void>;

  revokeSession(sessionId: string, reason: AdminSessionRevokedReason, at: Date): Promise<void>;
}

export interface AdminSessionStore {
  run<T>(work: (tx: AdminSessionTransaction) => Promise<T>): Promise<T>;
}

export const ADMIN_SESSION_STORE = Symbol('ADMIN_SESSION_STORE');
