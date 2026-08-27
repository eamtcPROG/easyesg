import type { AccountEffect } from '@api/modules/identity/account/interfaces/account-store.interface';
import { emailIdentityKey } from '@api/modules/identity/account/domain/email-address';
import type {
  Account,
  NewVerificationToken,
} from '@api/modules/identity/account/models/account.model';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import type {
  FakeRefreshToken,
  FakeStoredSession,
} from '@api/modules/identity/session/testing/session-store.fake';
import type { Session } from '@api/modules/identity/session/models/session.model';
import type { SocialProvider } from '@api/contracts/identity-provider.port';
import type {
  SocialSignInStore,
  SocialSignInTransaction,
} from '../interfaces/social-sign-in-store.interface';
import type { NewProviderAccount, ProviderIdentity } from '../models/provider-identity.model';
import { SocialEmailInUseError } from '../errors/social.errors';

/**
 * An in-memory `SocialSignInStore` — `FakeSessionStore`'s design, rollback included, because this
 * use case's specs assert BOTH directions: the unverified-registration path must show its account
 * and challenge SURVIVING the 403 (returned as an outcome, thrown after commit), and the
 * collision path must show the reclaim of an expired account rolling back harmlessly with the
 * throw. Only a fake that genuinely restores on throw can tell those apart.
 */
interface Snapshot {
  accounts: Account[];
  identities: ProviderIdentity[];
  passwords: [string, string][];
  sessions: FakeStoredSession[];
  refreshTokens: FakeRefreshToken[];
  attempts: { key: string; at: Date }[];
  verificationTokens: NewVerificationToken[];
  effects: AccountEffect[];
}

export class FakeSocialSignInStore implements SocialSignInStore {
  accounts: Account[] = [];
  identities: ProviderIdentity[] = [];

  /** Account ids holding a password row, and its digest — BR-ID-4's other credential kind. */
  passwords = new Map<string, string>();
  sessions: FakeStoredSession[] = [];
  refreshTokens: FakeRefreshToken[] = [];
  attempts: { key: string; at: Date }[] = [];
  verificationTokens: NewVerificationToken[] = [];
  effects: AccountEffect[] = [];

  rollbacks = 0;

  private nextId = 1;

  seedAccount(account: Account): void {
    this.accounts.push(account);
  }

  seedIdentity(identity: ProviderIdentity): void {
    this.identities.push(identity);
  }

  async run<T>(work: (tx: SocialSignInTransaction) => Promise<T>): Promise<T> {
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
      identities: this.identities.map((identity) => ({ ...identity })),
      passwords: [...this.passwords.entries()],
      sessions: this.sessions.map((session) => ({ ...session })),
      refreshTokens: this.refreshTokens.map((token) => ({ ...token })),
      attempts: this.attempts.map((attempt) => ({ ...attempt })),
      verificationTokens: [...this.verificationTokens],
      effects: [...this.effects],
    };
  }

  private restore(snapshot: Snapshot): void {
    this.accounts = snapshot.accounts;
    this.identities = snapshot.identities;
    this.passwords = new Map(snapshot.passwords);
    this.sessions = snapshot.sessions;
    this.refreshTokens = snapshot.refreshTokens;
    this.attempts = snapshot.attempts;
    this.verificationTokens = snapshot.verificationTokens;
    this.effects = snapshot.effects;
  }

  private transaction(): SocialSignInTransaction {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the closure below IS the tx.
    const store = this;

    return {
      countRecentAuthAttempts(key: string, since: Date): Promise<number> {
        return Promise.resolve(
          store.attempts.filter((a) => a.key === key && a.at.getTime() >= since.getTime()).length,
        );
      },

      recordAuthAttempt(key: string, at: Date): Promise<void> {
        store.attempts.push({ key, at });
        return Promise.resolve();
      },

      findProviderIdentity(
        provider: SocialProvider,
        subject: string,
      ): Promise<ProviderIdentity | null> {
        return Promise.resolve(
          store.identities.find((i) => i.provider === provider && i.subject === subject) ?? null,
        );
      },

      findAccountById(accountId: string): Promise<Account | null> {
        return Promise.resolve(store.accounts.find((a) => a.id === accountId) ?? null);
      },

      findAccountByEmail(email: string): Promise<Account | null> {
        const key = emailIdentityKey(email);
        return Promise.resolve(
          store.accounts.find((a) => emailIdentityKey(a.email) === key) ?? null,
        );
      },

      refreshProviderAssertion(
        identity: {
          readonly id: string;
          readonly assertedEmail: string;
          readonly emailVerifiedAsserted: boolean;
        },
        at: Date,
      ): Promise<void> {
        // The instant feeds `updated_at`, a column the fake's model deliberately lacks.
        void at;
        store.identities = store.identities.map((existing) =>
          existing.id === identity.id
            ? {
                ...existing,
                assertedEmail: identity.assertedEmail,
                emailVerifiedAsserted: identity.emailVerifiedAsserted,
              }
            : existing,
        );
        return Promise.resolve();
      },

      markAccountVerified(accountId: string, at: Date): Promise<Account> {
        const account = store.accounts.find((a) => a.id === accountId);
        if (!account) return Promise.reject(new Error('no such account'));
        const verified: Account = {
          ...account,
          status: ACCOUNT_STATUS.ACTIVE,
          verifiedAt: at,
          updatedAt: at,
        };
        store.accounts = store.accounts.map((a) => (a.id === accountId ? verified : a));
        return Promise.resolve(verified);
      },

      deleteAccount(accountId: string): Promise<void> {
        store.accounts = store.accounts.filter((a) => a.id !== accountId);
        // The cascade the schema provides: identities and tokens go with the account.
        store.identities = store.identities.filter((i) => i.accountId !== accountId);
        store.verificationTokens = store.verificationTokens.filter(
          (t) => t.accountId !== accountId,
        );
        return Promise.resolve();
      },

      createProviderAccount(account: NewProviderAccount): Promise<Account> {
        const key = emailIdentityKey(account.email);
        // The fake models the unique index the way the repository maps it (BR-ID-3's race).
        if (store.accounts.some((a) => emailIdentityKey(a.email) === key)) {
          return Promise.reject(new SocialEmailInUseError());
        }
        const created: Account = {
          id: `account-${store.nextId++}`,
          email: account.email,
          status: account.verifiedAt ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.UNVERIFIED,
          locale: account.locale,
          verifiedAt: account.verifiedAt,
          createdAt: account.verifiedAt ?? new Date(0),
          updatedAt: account.verifiedAt ?? new Date(0),
        };
        store.accounts.push(created);
        store.identities.push({
          id: `identity-${store.nextId++}`,
          accountId: created.id,
          provider: account.provider,
          subject: account.subject,
          assertedEmail: account.assertedEmail,
          emailVerifiedAsserted: account.emailVerifiedAsserted,
        });
        return Promise.resolve(created);
      },

      createSession(accountId: string, refreshTokenHash: Buffer, at: Date): Promise<Session> {
        const session: FakeStoredSession = {
          id: `session-${store.nextId++}`,
          accountId,
          createdAt: at,
          revokedAt: null,
          revokedReason: null,
        };
        store.sessions.push(session);
        store.refreshTokens.push({
          id: `token-${store.nextId++}`,
          sessionId: session.id,
          tokenHash: refreshTokenHash,
          issuedAt: at,
          consumedAt: null,
        });
        return Promise.resolve({ id: session.id, accountId, createdAt: at, revokedAt: null });
      },

      issueVerificationToken(token: NewVerificationToken): Promise<void> {
        store.verificationTokens.push(token);
        return Promise.resolve();
      },

      findProviderIdentitiesFor(accountId: string): Promise<ProviderIdentity[]> {
        return Promise.resolve(
          store.identities
            .filter((identity) => identity.accountId === accountId)
            .map((identity) => ({ ...identity })),
        );
      },

      hasPasswordCredential(accountId: string): Promise<boolean> {
        return Promise.resolve(store.passwords.has(accountId));
      },

      findPasswordDigest(accountId: string): Promise<string | null> {
        return Promise.resolve(store.passwords.get(accountId) ?? null);
      },

      linkProviderIdentity(
        identity: {
          readonly accountId: string;
          readonly provider: SocialProvider;
          readonly subject: string;
          readonly assertedEmail: string;
          readonly emailVerifiedAsserted: boolean;
        },
      ): Promise<boolean> {
        // BOTH unique constraints, modelled: `(provider, subject)` is the takeover guard and
        // `(account_id, provider)` is the one-per-provider shape rule. A fake enforcing only the
        // first would let a spec prove the use case guards the second when the database does.
        const taken = store.identities.some(
          (existing) =>
            (existing.provider === identity.provider && existing.subject === identity.subject) ||
            (existing.accountId === identity.accountId && existing.provider === identity.provider),
        );
        if (taken) return Promise.resolve(false);
        store.identities.push({ id: `identity-${store.identities.length + 1}`, ...identity });
        return Promise.resolve(true);
      },

      unlinkProviderIdentity(
        identity: { readonly accountId: string; readonly provider: SocialProvider },
      ): Promise<boolean> {
        const before = store.identities.length;
        store.identities = store.identities.filter(
          (existing) =>
            !(existing.accountId === identity.accountId && existing.provider === identity.provider),
        );
        return Promise.resolve(store.identities.length < before);
      },

      emit(effect: AccountEffect): Promise<void> {
        store.effects.push(effect);
        return Promise.resolve();
      },
    };
  }
}
