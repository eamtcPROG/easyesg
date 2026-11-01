import {
  ACCOUNT_STATUS,
  PASSWORD_RESET_TOKEN_PURPOSE,
  type Account,
  type ClaimedPasswordResetToken,
  type PasswordResetTokenPurpose,
} from '@api/modules/identity/account/models/account.model';
import type { NewSession, Session } from '@api/modules/identity/session/models/session.model';
import type {
  AccountSetupStore,
  AccountSetupTransaction,
} from '../interfaces/account-setup-store.interface';
import type { AccountSetupState, SetupProfile } from '../models/account-setup.model';

interface StoredResetToken {
  accountId: string;
  tokenHash: Buffer;
  expiresAt: Date;
  consumedAt: Date | null;
  /** The table's `purpose` column — this store claims only `account_setup` rows, as its adapter does. */
  purpose: PasswordResetTokenPurpose;
}

interface RevokedSessions {
  accountId: string;
  at: Date;
}

interface Snapshot {
  accounts: Account[];
  passwords: [string, string][];
  resetTokens: StoredResetToken[];
  createdSessions: NewSession[];
  revokedSessions: RevokedSessions[];
}

/**
 * An in-memory `AccountSetupStore` for the setup use-case specs (task 155) — `FakeAccountStore`'s
 * design, rollback included, because those specs assert that a refused first password leaves the
 * grant unspent and no credential written, which only a fake that restores on throw can show.
 */
export class FakeAccountSetupStore implements AccountSetupStore {
  accounts: Account[] = [];
  /** Account ids holding a password row, and its digest. */
  passwords = new Map<string, string>();
  /** Session id → creation instant — the proof a first password rests on. Read-only here. */
  sessionCreatedAt = new Map<string, Date>();
  resetTokens: StoredResetToken[] = [];
  createdSessions: NewSession[] = [];
  /** Every `revokeAccountSessions` call — FR-6's revocation, as the specs assert it. */
  revokedSessions: RevokedSessions[] = [];

  rollbacks = 0;

  private nextId = 1;

  async run<T>(work: (tx: AccountSetupTransaction) => Promise<T>): Promise<T> {
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
      passwords: [...this.passwords.entries()],
      resetTokens: this.resetTokens.map((token) => ({ ...token })),
      createdSessions: [...this.createdSessions],
      revokedSessions: [...this.revokedSessions],
    };
  }

  private restore(snapshot: Snapshot): void {
    this.accounts = snapshot.accounts;
    this.passwords = new Map(snapshot.passwords);
    this.resetTokens = snapshot.resetTokens;
    this.createdSessions = snapshot.createdSessions;
    this.revokedSessions = snapshot.revokedSessions;
  }

  private transaction(): AccountSetupTransaction {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the closure below IS the tx.
    const store = this;

    const find = (accountId: string): Account | undefined =>
      store.accounts.find((account) => account.id === accountId);

    const replace = (account: Account): Promise<Account> => {
      store.accounts = store.accounts.map((existing) => (existing.id === account.id ? account : existing));
      return Promise.resolve(account);
    };

    // The adapter's WHERE clause, modelled: a grant, unconsumed.
    const unspentGrant = (grantHash: Buffer): StoredResetToken | undefined =>
      store.resetTokens.find(
        (t) =>
          t.tokenHash.equals(grantHash) &&
          t.purpose === PASSWORD_RESET_TOKEN_PURPOSE.ACCOUNT_SETUP &&
          !t.consumedAt,
      );

    return {
      findAccountForSetup(accountId: string): Promise<AccountSetupState | null> {
        const account = find(accountId);
        return Promise.resolve(
          account === undefined ? null : { account, passwordSet: store.passwords.has(accountId) },
        );
      },

      findSessionCreatedAt(sessionId: string): Promise<Date | null> {
        return Promise.resolve(store.sessionCreatedAt.get(sessionId) ?? null);
      },

      accountSetupGrantIsLive(grantHash: Buffer, at: Date): Promise<boolean> {
        const grant = unspentGrant(grantHash);
        return Promise.resolve(grant !== undefined && grant.expiresAt.getTime() > at.getTime());
      },

      claimAccountSetupGrant(grantHash: Buffer, at: Date): Promise<ClaimedPasswordResetToken | null> {
        const grant = unspentGrant(grantHash);
        if (grant === undefined) return Promise.resolve(null);
        grant.consumedAt = at;
        return Promise.resolve({ accountId: grant.accountId, expiresAt: grant.expiresAt });
      },

      insertFirstPassword(credential: {
        readonly accountId: string;
        readonly passwordHash: string;
      }): Promise<boolean> {
        // The primary key, modelled — a fake that overwrote would let a spec prove the use case guards
        // a race the database decides.
        if (store.passwords.has(credential.accountId)) return Promise.resolve(false);
        store.passwords.set(credential.accountId, credential.passwordHash);
        return Promise.resolve(true);
      },

      saveSetupProfile(profile: SetupProfile, at: Date): Promise<Account> {
        const account = find(profile.accountId);
        if (account === undefined) return Promise.reject(new Error('no such account'));
        return replace({
          ...account,
          givenName: profile.givenName,
          familyName: profile.familyName,
          locale: profile.locale,
          updatedAt: at,
        });
      },

      activateAccount(accountId: string, at: Date): Promise<Account> {
        const account = find(accountId);
        if (account === undefined) return Promise.reject(new Error('no such account'));
        return replace({ ...account, status: ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null, updatedAt: at });
      },

      revokeAccountSessions(accountId: string, at: Date): Promise<void> {
        store.revokedSessions.push({ accountId, at });
        return Promise.resolve();
      },

      createSession(input: NewSession): Promise<Session> {
        store.createdSessions.push(input);
        return Promise.resolve({
          id: `session-${store.nextId++}`,
          accountId: input.accountId,
          createdAt: input.at,
          remembered: input.remembered,
          revokedAt: null,
        });
      },
    };
  }
}
