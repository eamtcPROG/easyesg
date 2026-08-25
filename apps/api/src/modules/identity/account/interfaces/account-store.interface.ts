import type {
  Account,
  ClaimedPasswordResetToken,
  ClaimedVerificationToken,
  NewAccount,
  NewPasswordResetToken,
  NewVerificationToken,
} from '../models/account.model';
import type { InvitationStatus } from '@api/modules/identity/invitation/models/invitation.model';

/**
 * The `identity/account` store, and the transaction it runs in.
 *
 * **Why a unit of work rather than a repository per table.** P-8 requires a state change and the
 * outbox row it causes to commit together or not at all; AD-6 says the same thing from the other
 * side. Registration is four writes — account, credential, verification token, outbox row — and
 * three of them being durable without the fourth is a distinct failure each time: an account
 * nobody can sign in to, an account nobody can verify, or a verification email for an account that
 * does not exist. Handing the use case one transactional scope is what makes "all four or none" a
 * property of the interface instead of a discipline the next author has to know about.
 *
 * The use case therefore stays framework-free while still controlling atomicity: `run` is the only
 * thing it knows about transactions, and a fake implementation in a unit test is a closure.
 *
 * This is the first instance of a shape every later module needs — task 25's memberships, task
 * 31's report lifecycle, task 57's invoice issuance — so it is written to be copied.
 */
export interface AccountTransaction {
  /**
   * Throws `EmailAlreadyRegisteredError` when the address is taken. The check is the unique index,
   * not a prior `SELECT`: two simultaneous registrations of one address both pass a read-then-write
   * check and one of them is wrong, whereas the index is decided by PostgreSQL exactly once.
   */
  insertUnverifiedAccount(account: NewAccount): Promise<Account>;

  /** By `lower(email)`, matching `account_email_key`. Null when nothing holds the address. */
  findAccountByEmail(email: string): Promise<Account | null>;

  issueVerificationToken(token: NewVerificationToken): Promise<void>;

  /**
   * Retires every outstanding token for an account, so a reissue (OQ-55) leaves exactly one live
   * challenge rather than accumulating one per request.
   *
   * It writes `consumed_at`, which therefore means "no longer usable" rather than strictly "was
   * used". That reading is what the claim query already tests, and a second nullable column
   * distinguishing spent from superseded would carry no decision anybody makes.
   */
  invalidateOutstandingVerificationTokens(accountId: string, at: Date): Promise<void>;

  /**
   * Marks the token consumed and returns it, atomically — or returns null if it was already
   * consumed, or never existed.
   *
   * **Single-use is this method's whole responsibility, and it cannot be the use case's.** Two
   * requests carrying the same link arrive concurrently; a read-then-write in application code
   * lets both see `consumed_at IS NULL`. Only a conditional UPDATE can decide it once, which is
   * why the port exposes "claim" rather than "find" and "markConsumed".
   *
   * Expiry is deliberately **not** checked here — the caller compares the returned `expiresAt`.
   * Note what that does and does not buy: an expired token is claimed and then un-claimed, because
   * the caller's rejection rolls the transaction back. That is harmless, since an expired token can
   * never verify anything however often it is presented. The concurrency case is the one this
   * ordering exists for, and it is not harmless.
   */
  claimVerificationToken(tokenHash: Buffer, at: Date): Promise<ClaimedVerificationToken | null>;

  findAccountById(accountId: string): Promise<Account | null>;

  markAccountVerified(accountId: string, at: Date): Promise<Account>;

  /**
   * The invitation a registration presented, or null when the token names none — FR-3's third
   * route to a verified account (§12.5.6's task-26.2 row, task 26.2).
   *
   * **It returns the row and judges nothing.** Whether the invitation is live, and whether it names
   * this address, are decided by `invitationIsAcceptable` and `emailIdentityKey` — the same two
   * functions acceptance itself uses. A store method answering "does this vouch?" would be a second
   * definition of a live invitation, and the two would drift the day one of them learned about a
   * new status.
   *
   * **It takes the raw token, and the adapter hashes it.** The wire never carries a hash: a route
   * accepting one would make the stored value the credential, which is what NFR-64's
   * SHA-256-at-rest rule exists to deny. The adapter reads through `invitation_bearer_select` by
   * binding `app.current_invitation`, so this transaction sees exactly the one row the token names
   * and no other invitation in the system.
   */
  findPresentedInvitation(token: string): Promise<PresentedInvitation | null>;

  /** §12.5.6's throttle window — same semantics as the session store's pair (task 21). */
  countRecentAuthAttempts(key: string, since: Date): Promise<number>;

  recordAuthAttempt(key: string, at: Date): Promise<void>;

  /** FR-6's reissue rule, same as the verification flow: one live challenge per account. */
  invalidateOutstandingPasswordResetTokens(accountId: string, at: Date): Promise<void>;

  issuePasswordResetToken(token: NewPasswordResetToken): Promise<void>;

  /**
   * Single-use by conditional UPDATE, for `claimVerificationToken`'s reason exactly; expiry is
   * the caller's comparison, and an expired claim un-claims by rollback, harmlessly.
   */
  claimPasswordResetToken(tokenHash: Buffer, at: Date): Promise<ClaimedPasswordResetToken | null>;

  /**
   * Replaces the hash AND clears the lockout in one statement — §12.5.6 names the consumed reset
   * link as a lockout release, so the two must not be separable. False when the account holds no
   * password credential, which the caller treats as an invalid token rather than explaining.
   */
  replaceCredentialPassword(
    credential: { readonly accountId: string; readonly passwordHash: string },
    at: Date,
  ): Promise<boolean>;

  /**
   * FR-6: consuming a reset link invalidates every live session for the account, recorded with
   * the `password_reset` reason. The reason is baked into the method rather than passed, because
   * FR-6 is this port's only session-revoking caller and a reason parameter here would hand the
   * account module the session module's vocabulary. On this transaction, so a reset that fails
   * to commit revokes nothing.
   */
  revokeAllSessionsForPasswordReset(accountId: string, at: Date): Promise<void>;

  /** OQ-52's expiry. `ON DELETE CASCADE` takes the credential and any outstanding tokens with it. */
  deleteAccount(accountId: string): Promise<void>;

  /**
   * Writes an outbox row on **this** transaction's runner (AD-6, P-8). It is on the transaction
   * interface rather than on a separate port for exactly that reason: a port that could be called
   * outside the transaction would be a dual write available by accident.
   */
  emit(effect: AccountEffect): Promise<void>;
}

/**
 * As much of an invitation as registration needs to decide FR-3's verification question — the
 * address it binds to and whether it is still live (task 26.2).
 *
 * Deliberately three fields rather than the whole row: registration is not accepting anything, so
 * the role, the organization and the locale are none of its business. The two `Invitation` fields
 * are structurally what `invitationIsAcceptable` takes, which is the point — the predicate is
 * shared, not reimplemented.
 */
export interface PresentedInvitation {
  readonly invitedEmail: string;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
}

/**
 * A cross-boundary effect, in the outbox's terms but without its types — the use case must not
 * import `infrastructure/outbox`.
 */
export interface AccountEffect {
  /** Becomes the BullMQ job name, which is how a consumer selects work on AD-10's single queue. */
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  /**
   * AD-6 requires this to be generated in the originating transaction and to be a natural key
   * wherever one exists, so that two attempts at the same business action produce one effect.
   */
  readonly idempotencyKey: string;
}

export interface AccountStore {
  run<T>(work: (tx: AccountTransaction) => Promise<T>): Promise<T>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const ACCOUNT_STORE = Symbol('ACCOUNT_STORE');
