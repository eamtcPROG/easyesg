import type { Account, Credential } from '@api/modules/identity/account/models/account.model';
import { emailIdentityKey } from '@api/modules/identity/account/domain/email-address';
import type {
  SessionStore,
  SessionTransaction,
} from '../interfaces/session-store.interface';
import type {
  PresentedRefreshToken,
  Session,
  SessionRevokedReason,
} from '../models/session.model';
import {
  FACTOR_CHALLENGE_KIND,
  readFactorChallenge,
  type FactorChallengePayload,
} from '../domain/factor-challenge';

/**
 * An in-memory `SessionStore` for the use-case specs — `FakeAccountStore`'s design, including
 * the property that earns a fake its keep: **`run` snapshots and restores on throw**, so a spec
 * can assert what committed and what rolled back. For this store the interesting direction is
 * inverted: sign-in's specs assert that counters SURVIVE a refusal (the use case commits before
 * it throws), and only a fake that genuinely rolls back on throw can prove that shape is what
 * keeps them.
 */
export interface FakeStoredSession {
  id: string;
  accountId: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevokedReason | null;
}

export interface FakeRefreshToken {
  id: string;
  sessionId: string;
  tokenHash: Buffer;
  issuedAt: Date;
  consumedAt: Date | null;
}

interface Snapshot {
  accounts: Account[];
  credentials: [string, Credential][];
  sessions: FakeStoredSession[];
  refreshTokens: FakeRefreshToken[];
  attempts: { key: string; at: Date }[];
}

export class FakeSessionStore implements SessionStore {
  accounts: Account[] = [];
  credentials = new Map<string, Credential>();
  sessions: FakeStoredSession[] = [];
  refreshTokens: FakeRefreshToken[] = [];
  attempts: { key: string; at: Date }[] = [];

  rollbacks = 0;

  private nextId = 1;

  seedAccount(account: Account, credential?: Omit<Credential, 'accountId'>): void {
    this.accounts.push(account);
    if (credential) this.credentials.set(account.id, { accountId: account.id, ...credential });
  }

  liveTokensFor(sessionId: string): FakeRefreshToken[] {
    return this.refreshTokens.filter((t) => t.sessionId === sessionId && !t.consumedAt);
  }

  async run<T>(work: (tx: SessionTransaction) => Promise<T>): Promise<T> {
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
      sessions: this.sessions.map((session) => ({ ...session })),
      refreshTokens: this.refreshTokens.map((token) => ({ ...token })),
      attempts: this.attempts.map((attempt) => ({ ...attempt })),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.accounts = snapshot.accounts;
    this.credentials = new Map(snapshot.credentials);
    this.sessions = snapshot.sessions;
    this.refreshTokens = snapshot.refreshTokens;
    this.attempts = snapshot.attempts;
  }

  private transaction(): SessionTransaction {
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

      findAccountByEmail(email: string): Promise<Account | null> {
        const key = emailIdentityKey(email);
        return Promise.resolve(
          store.accounts.find((a) => emailIdentityKey(a.email) === key) ?? null,
        );
      },

      findAccountById(accountId: string): Promise<Account | null> {
        return Promise.resolve(store.accounts.find((a) => a.id === accountId) ?? null);
      },

      findCredential(accountId: string): Promise<Credential | null> {
        const credential = store.credentials.get(accountId);
        return Promise.resolve(credential ? { ...credential } : null);
      },

      registerFailedSignIn(accountId: string, threshold: number, at: Date): Promise<void> {
        const credential = store.credentials.get(accountId);
        if (!credential) return Promise.resolve();
        const failedAttempts = credential.failedAttempts + 1;
        store.credentials.set(accountId, {
          ...credential,
          failedAttempts,
          lockedAt:
            failedAttempts >= threshold ? (credential.lockedAt ?? at) : credential.lockedAt,
        });
        return Promise.resolve();
      },

      clearFailedSignIns(accountId: string): Promise<void> {
        const credential = store.credentials.get(accountId);
        if (credential && credential.failedAttempts !== 0) {
          store.credentials.set(accountId, { ...credential, failedAttempts: 0 });
        }
        return Promise.resolve();
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
        return Promise.resolve({
          id: session.id,
          accountId,
          createdAt: at,
          revokedAt: null,
        });
      },

      findRefreshToken(tokenHash: Buffer): Promise<PresentedRefreshToken | null> {
        const token = store.refreshTokens.find((t) => t.tokenHash.equals(tokenHash));
        if (!token) return Promise.resolve(null);
        const session = store.sessions.find((s) => s.id === token.sessionId);
        if (!session) return Promise.resolve(null);
        return Promise.resolve({
          tokenId: token.id,
          sessionId: session.id,
          accountId: session.accountId,
          tokenIssuedAt: token.issuedAt,
          tokenConsumedAt: token.consumedAt,
          sessionCreatedAt: session.createdAt,
          sessionRevokedAt: session.revokedAt,
        });
      },

      consumeRefreshToken(tokenId: string, at: Date): Promise<boolean> {
        const token = store.refreshTokens.find((t) => t.id === tokenId);
        if (!token || token.consumedAt) return Promise.resolve(false);
        token.consumedAt = at;
        return Promise.resolve(true);
      },

      issueRefreshToken(sessionId: string, tokenHash: Buffer, at: Date): Promise<void> {
        store.refreshTokens.push({
          id: `token-${store.nextId++}`,
          sessionId,
          tokenHash,
          issuedAt: at,
          consumedAt: null,
        });
        return Promise.resolve();
      },

      revokeSession(sessionId: string, reason: SessionRevokedReason, at: Date): Promise<void> {
        const session = store.sessions.find((s) => s.id === sessionId);
        if (session && !session.revokedAt) {
          session.revokedAt = at;
          session.revokedReason = reason;
        }
        return Promise.resolve();
      },
    };
  }
}

/** AD-12's claim discipline is the adapter's; specs only need a recognisable string back. */
export class FakeAccessTokenSigner {
  readonly signed: { sessionId: string; expiresAt: Date }[] = [];

  sign(sessionId: string, expiresAt: Date): Promise<string> {
    this.signed.push({ sessionId, expiresAt });
    return Promise.resolve(`signed:${sessionId}:${expiresAt.getTime()}`);
  }
}

/**
 * A `SecondFactor` the sign-in specs can steer (task 27.3).
 *
 * It models the two things sign-in asks and nothing else, which is the point of the port being
 * two methods: a fake standing in for `ManageTotp` would have had to model enrolment, confirmation
 * and re-issue to answer one question.
 */
export class FakeSecondFactor {
  /** Account ids with a **confirmed** factor. An unconfirmed enrolment is not in this set. */
  readonly enrolled = new Set<string>();

  /** Answers `verify` accepts. Spent on use, so a spec can assert single-use (UC-195). */
  readonly answers = new Map<string, string[]>();

  isEnrolled(accountId: string): Promise<boolean> {
    return Promise.resolve(this.enrolled.has(accountId));
  }

  verify(answer: { readonly accountId: string; readonly code: string }): Promise<boolean> {
    const remaining = this.answers.get(answer.accountId) ?? [];
    const index = remaining.indexOf(answer.code);
    if (index === -1) return Promise.resolve(false);
    // Modelled as spent, because the real one spends a recovery code on success and a spec that
    // could replay an answer would prove the opposite of UC-195.
    remaining.splice(index, 1);
    return Promise.resolve(true);
  }
}

/**
 * A `FactorChallengeSealer` with no crypto — the payload travels as JSON.
 *
 * Deliberately readable: these specs are about the *branch*, and a real seal would only prove that
 * `node:crypto` works. What must stay honest is the `null` on anything unrecognised, since that is
 * the path a forged or stale challenge takes.
 */
export class FakeChallengeSealer {
  seal(challenge: { readonly accountId: string; readonly issuedAt: number }): string {
    return JSON.stringify({ ...challenge, kind: FACTOR_CHALLENGE_KIND });
  }

  open(sealed: string): FactorChallengePayload | null {
    try {
      return readFactorChallenge(JSON.parse(sealed));
    } catch {
      return null;
    }
  }
}
