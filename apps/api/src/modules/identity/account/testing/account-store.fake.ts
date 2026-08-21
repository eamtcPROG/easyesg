import type {
  AccountEffect,
  AccountStore,
  AccountTransaction,
} from '../interfaces/account-store.interface';
import {
  ACCOUNT_STATUS,
  type Account,
  type ClaimedPasswordResetToken,
  type ClaimedVerificationToken,
  type Credential,
  type NewAccount,
  type NewPasswordResetToken,
  type NewVerificationToken,
} from '../models/account.model';
import { EmailAlreadyRegisteredError } from '../errors/account.errors';
import { emailIdentityKey } from '../domain/email-address';

/**
 * An in-memory `AccountStore` for the use-case specs.
 *
 * **It models rollback, which is the only reason it is worth more than a stub.** `run` snapshots
 * its state, and restores it when the callback throws. That is what lets a spec assert the thing
 * these use cases actually depend on — that a rejected verification leaves no consumed token, and
 * that a failed registration leaves no account and no outbox row — rather than only that an error
 * was raised. A fake that committed everything would pass those specs while the real adapter's
 * transaction handling was broken.
 *
 * It also enforces the duplicate-address rule the way the database does, at insert, so a spec
 * cannot accidentally prove the use case's pre-read is the check when it is not.
 */
interface StoredToken {
  accountId: string;
  tokenHash: Buffer;
  expiresAt: Date;
  consumedAt: Date | null;
}

/** A session as FR-6's revocation sees it — enough to assert "every live one died". */
export interface FakeSession {
  id: string;
  accountId: string;
  revokedAt: Date | null;
  revokedReason: string | null;
}

interface Snapshot {
  accounts: Account[];
  credentials: [string, Credential][];
  tokens: StoredToken[];
  resetTokens: StoredToken[];
  sessions: FakeSession[];
  attempts: { key: string; at: Date }[];
  effects: AccountEffect[];
}

export class FakeAccountStore implements AccountStore {
  accounts: Account[] = [];
  credentials = new Map<string, Credential>();
  tokens: StoredToken[] = [];
  resetTokens: StoredToken[] = [];
  sessions: FakeSession[] = [];
  attempts: { key: string; at: Date }[] = [];
  effects: AccountEffect[] = [];

  /** How many times `run` rolled back. A spec asserting "nothing was written" checks this too. */
  rollbacks = 0;

  private nextId = 1;

  /**
   * The database's `now()`, which is what stamps `created_at` — not the use case's clock, which
   * stamps decisions. They are separate on purpose: OQ-52's window is measured from when the row
   * was written, so a spec exercising expiry has to be able to age a row independently of the
   * clock the use case reads. Without this the fake stamped the real wall clock and no account
   * could ever be old enough to expire.
   */
  constructor(private readonly databaseClock: () => Date = () => new Date()) {}

  async run<T>(work: (tx: AccountTransaction) => Promise<T>): Promise<T> {
    const snapshot = this.snapshot();
    try {
      return await work(this.transaction());
    } catch (error) {
      this.restore(snapshot);
      this.rollbacks += 1;
      throw error;
    }
  }

  private snapshot(): Snapshot {
    return {
      accounts: [...this.accounts],
      credentials: [...this.credentials.entries()].map(
        ([id, credential]): [string, Credential] => [id, { ...credential }],
      ),
      tokens: this.tokens.map((token) => ({ ...token })),
      resetTokens: this.resetTokens.map((token) => ({ ...token })),
      sessions: this.sessions.map((session) => ({ ...session })),
      attempts: this.attempts.map((attempt) => ({ ...attempt })),
      effects: [...this.effects],
    };
  }

  private restore(snapshot: Snapshot): void {
    this.accounts = snapshot.accounts;
    this.credentials = new Map(snapshot.credentials);
    this.tokens = snapshot.tokens;
    this.resetTokens = snapshot.resetTokens;
    this.sessions = snapshot.sessions;
    this.attempts = snapshot.attempts;
    this.effects = snapshot.effects;
  }

  private transaction(): AccountTransaction {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the closure below IS the tx.
    const store = this;

    return {
      insertUnverifiedAccount(account: NewAccount): Promise<Account> {
        // The unique index, modelled. The use case's pre-read is for expiry, not for this.
        if (store.accounts.some((a) => emailIdentityKey(a.email) === emailIdentityKey(account.email))) {
          return Promise.reject(new EmailAlreadyRegisteredError());
        }
        const now = store.databaseClock();
        const created: Account = {
          id: `account-${store.nextId++}`,
          email: account.email,
          status: ACCOUNT_STATUS.UNVERIFIED,
          locale: account.locale,
          verifiedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        store.accounts.push(created);
        store.credentials.set(created.id, {
          accountId: created.id,
          passwordHash: account.passwordHash,
          failedAttempts: 0,
          lockedAt: null,
        });
        return Promise.resolve(created);
      },

      findAccountByEmail(email: string): Promise<Account | null> {
        const key = emailIdentityKey(email);
        return Promise.resolve(store.accounts.find((a) => emailIdentityKey(a.email) === key) ?? null);
      },

      findAccountById(accountId: string): Promise<Account | null> {
        return Promise.resolve(store.accounts.find((a) => a.id === accountId) ?? null);
      },

      issueVerificationToken(token: NewVerificationToken): Promise<void> {
        store.tokens.push({ ...token, consumedAt: null });
        return Promise.resolve();
      },

      invalidateOutstandingVerificationTokens(accountId: string, at: Date): Promise<void> {
        for (const token of store.tokens) {
          if (token.accountId === accountId && !token.consumedAt) token.consumedAt = at;
        }
        return Promise.resolve();
      },

      claimVerificationToken(tokenHash: Buffer, at: Date): Promise<ClaimedVerificationToken | null> {
        const token = store.tokens.find((t) => t.tokenHash.equals(tokenHash) && !t.consumedAt);
        if (!token) return Promise.resolve(null);
        token.consumedAt = at;
        return Promise.resolve({
          accountId: token.accountId,
          tokenHash: token.tokenHash,
          expiresAt: token.expiresAt,
        });
      },

      markAccountVerified(accountId: string, at: Date): Promise<Account> {
        const index = store.accounts.findIndex((a) => a.id === accountId);
        const verified: Account = {
          ...store.accounts[index],
          status: ACCOUNT_STATUS.ACTIVE,
          verifiedAt: at,
          updatedAt: at,
        };
        store.accounts[index] = verified;
        return Promise.resolve(verified);
      },

      deleteAccount(accountId: string): Promise<void> {
        store.accounts = store.accounts.filter((a) => a.id !== accountId);
        store.credentials.delete(accountId);
        // ON DELETE CASCADE, modelled — otherwise a spec could pass while the real schema
        // orphaned every token of a reclaimed account.
        store.tokens = store.tokens.filter((t) => t.accountId !== accountId);
        return Promise.resolve();
      },

      countRecentAuthAttempts(key: string, since: Date): Promise<number> {
        return Promise.resolve(
          store.attempts.filter((a) => a.key === key && a.at.getTime() >= since.getTime()).length,
        );
      },

      recordAuthAttempt(key: string, at: Date): Promise<void> {
        store.attempts.push({ key, at });
        return Promise.resolve();
      },

      invalidateOutstandingPasswordResetTokens(accountId: string, at: Date): Promise<void> {
        for (const token of store.resetTokens) {
          if (token.accountId === accountId && !token.consumedAt) token.consumedAt = at;
        }
        return Promise.resolve();
      },

      issuePasswordResetToken(token: NewPasswordResetToken): Promise<void> {
        store.resetTokens.push({ ...token, consumedAt: null });
        return Promise.resolve();
      },

      claimPasswordResetToken(
        tokenHash: Buffer,
        at: Date,
      ): Promise<ClaimedPasswordResetToken | null> {
        const token = store.resetTokens.find((t) => t.tokenHash.equals(tokenHash) && !t.consumedAt);
        if (!token) return Promise.resolve(null);
        token.consumedAt = at;
        return Promise.resolve({ accountId: token.accountId, expiresAt: token.expiresAt });
      },

      replaceCredentialPassword(
        credential: { readonly accountId: string; readonly passwordHash: string },
        at: Date,
      ): Promise<boolean> {
        void at;
        const existing = store.credentials.get(credential.accountId);
        if (!existing) return Promise.resolve(false);
        store.credentials.set(credential.accountId, {
          ...existing,
          passwordHash: credential.passwordHash,
          failedAttempts: 0,
          lockedAt: null,
        });
        return Promise.resolve(true);
      },

      revokeAllSessionsForPasswordReset(accountId: string, at: Date): Promise<void> {
        for (const session of store.sessions) {
          if (session.accountId === accountId && !session.revokedAt) {
            session.revokedAt = at;
            // Literal on purpose, and it is the migration's exception rather than a lapse from
            // the closed-vocabulary rule: this fake stands in for the DATABASE, whose own copy
            // of the vocabulary is the `session_revoked_reason_known` CHECK. Importing
            // `SESSION_REVOKED_REASON` here would also hand the account module the session
            // module's vocabulary — the exact coupling the port avoids by baking the reason into
            // the method name instead of taking it as a parameter.
            session.revokedReason = 'password_reset';
          }
        }
        return Promise.resolve();
      },

      emit(effect: AccountEffect): Promise<void> {
        store.effects.push(effect);
        return Promise.resolve();
      },
    };
  }
}

/** A hasher that is not Argon2, so a use-case spec costs no memory and no native binding. */
export class FakePasswordHasher {
  readonly hashed: string[] = [];

  /**
   * Every digest `verify` was asked about, recorded so sign-in's timing-uniformity spec can
   * assert the unknown-address path still performed a verification (task 21) — a property that
   * would otherwise only be observable with a stopwatch.
   */
  readonly verified: string[] = [];

  hash(password: string): Promise<string> {
    this.hashed.push(password);
    return Promise.resolve(`hashed:${password}`);
  }

  verify(candidate: { readonly digest: string; readonly password: string }): Promise<boolean> {
    this.verified.push(candidate.digest);
    return Promise.resolve(candidate.digest === `hashed:${candidate.password}`);
  }
}
