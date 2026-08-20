import type {
  AccountEffect,
  AccountStore,
  AccountTransaction,
} from '../interfaces/account-store.interface';
import {
  ACCOUNT_STATUS,
  type Account,
  type ClaimedVerificationToken,
  type NewAccount,
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

interface Snapshot {
  accounts: Account[];
  credentials: [string, string][];
  tokens: StoredToken[];
  effects: AccountEffect[];
}

export class FakeAccountStore implements AccountStore {
  accounts: Account[] = [];
  credentials = new Map<string, string>();
  tokens: StoredToken[] = [];
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
      credentials: [...this.credentials.entries()],
      tokens: this.tokens.map((token) => ({ ...token })),
      effects: [...this.effects],
    };
  }

  private restore(snapshot: Snapshot): void {
    this.accounts = snapshot.accounts;
    this.credentials = new Map(snapshot.credentials);
    this.tokens = snapshot.tokens;
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
        store.credentials.set(created.id, account.passwordHash);
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

  hash(password: string): Promise<string> {
    this.hashed.push(password);
    return Promise.resolve(`hashed:${password}`);
  }

  verify(digest: string, password: string): Promise<boolean> {
    return Promise.resolve(digest === `hashed:${password}`);
  }
}
