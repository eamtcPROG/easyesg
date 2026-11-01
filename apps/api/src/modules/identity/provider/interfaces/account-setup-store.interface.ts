import type { ClaimedPasswordResetToken, Account } from '@api/modules/identity/account/models/account.model';
import type { NewSession, Session } from '@api/modules/identity/session/models/session.model';
import type { AccountSetupState, SetupProfile } from '../models/account-setup.model';

/**
 * The account-setup store (task 155; §12.5.6's task-155 row) — its own port rather than a widening
 * of `SocialSignInTransaction` or `AccountTransaction`, on the Interface Segregation argument that
 * store's header makes: the setup flows compose operations over four tables (accounts, credentials,
 * reset tokens, sessions), and each existing store's callers would be handed capabilities they never
 * call. The unit-of-work shape is `AccountStore`'s, copied as it asks.
 */
export interface AccountSetupTransaction {
  /** The account and whether it holds a password. Null when no such account exists. */
  findAccountForSetup(accountId: string): Promise<AccountSetupState | null>;

  /**
   * When the session was created — the provider sign-in a first password's proof rests on. Null when
   * no such session exists. An account holding no password can hold no session but a provider
   * sign-in's, and refresh keeps this instant, so it is the proof itself rather than a stand-in.
   */
  findSessionCreatedAt(sessionId: string): Promise<Date | null>;

  /**
   * Whether a live grant — an `account_setup` token, unconsumed and unexpired at `at` — carries this
   * hash. **Read before the password is hashed**, so a public request presenting an unknown value costs
   * an indexed read rather than an Argon2id derivation; the claim below still decides single use.
   */
  accountSetupGrantIsLive(grantHash: Buffer, at: Date): Promise<boolean>;

  /**
   * `AccountTransaction.claimPasswordResetToken`'s contract — single-use by conditional UPDATE — for an
   * `account_setup` grant only, so an emailed reset link never reaches the route that signs its holder in.
   */
  claimAccountSetupGrant(grantHash: Buffer, at: Date): Promise<ClaimedPasswordResetToken | null>;

  /**
   * Inserts the account's first password. **False when one already exists** — the credential's primary
   * key decides it, not a prior read, so two submissions racing each other cannot both write one.
   */
  insertFirstPassword(
    credential: { readonly accountId: string; readonly passwordHash: string },
    at: Date,
  ): Promise<boolean>;

  saveSetupProfile(profile: SetupProfile, at: Date): Promise<Account>;

  /** `AccountTransaction.activateAccount`'s contract: `active`, and the deadline cleared with it. */
  activateAccount(accountId: string, at: Date): Promise<Account>;

  /**
   * `AccountTransaction.revokeAllSessionsForPasswordReset`'s contract — FR-6, since the grant is a reset
   * token: every session the account holds ends.
   */
  revokeAccountSessions(accountId: string, at: Date): Promise<void>;

  /** `SessionTransaction.createSession`'s contract — the session and its first refresh token together. */
  createSession(session: NewSession): Promise<Session>;
}

export interface AccountSetupStore {
  run<T>(work: (tx: AccountSetupTransaction) => Promise<T>): Promise<T>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const ACCOUNT_SETUP_STORE = Symbol('ACCOUNT_SETUP_STORE');
