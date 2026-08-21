import type {
  AdminSessionStore,
  AdminSessionTransaction,
} from '../interfaces/admin-session-store.interface';
import type {
  AdminAccount,
  AdminSessionRevokedReason,
  PresentedAdminRefreshToken,
  AdminSession,
} from '../models/admin-session.model';

/**
 * An in-memory `AdminSessionStore` for the use-case specs — `FakeSessionStore`'s design,
 * rollback included: **`run` snapshots and restores on throw**, because the sign-in specs
 * assert that failure counters SURVIVE a refusal (the use case commits before it throws), and
 * only a fake that genuinely rolls back can prove that shape is what keeps them.
 */
export interface FakeAdminSession {
  id: string;
  accountId: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokedReason: AdminSessionRevokedReason | null;
}

export interface FakeAdminRefreshToken {
  id: string;
  sessionId: string;
  tokenHash: Buffer;
  issuedAt: Date;
  consumedAt: Date | null;
}

interface Snapshot {
  accounts: AdminAccount[];
  sessions: FakeAdminSession[];
  refreshTokens: FakeAdminRefreshToken[];
  attempts: { key: string; at: Date }[];
}

export class FakeAdminSessionStore implements AdminSessionStore {
  accounts: AdminAccount[] = [];
  sessions: FakeAdminSession[] = [];
  refreshTokens: FakeAdminRefreshToken[] = [];
  attempts: { key: string; at: Date }[] = [];

  rollbacks = 0;

  private nextId = 1;

  async run<T>(work: (tx: AdminSessionTransaction) => Promise<T>): Promise<T> {
    const snapshot = this.snapshot();
    try {
      return await work(new FakeAdminSessionTransaction(this));
    } catch (error) {
      this.restore(snapshot);
      this.rollbacks += 1;
      throw error;
    }
  }

  mintId(): string {
    const id = this.nextId.toString().padStart(12, '0');
    this.nextId += 1;
    return `00000000-0000-7000-8000-${id}`;
  }

  private snapshot(): Snapshot {
    return {
      accounts: this.accounts.map((account) => ({ ...account })),
      sessions: this.sessions.map((session) => ({ ...session })),
      refreshTokens: this.refreshTokens.map((token) => ({ ...token })),
      attempts: this.attempts.map((attempt) => ({ ...attempt })),
    };
  }

  private restore(snapshot: Snapshot): void {
    this.accounts = snapshot.accounts;
    this.sessions = snapshot.sessions;
    this.refreshTokens = snapshot.refreshTokens;
    this.attempts = snapshot.attempts;
  }
}

class FakeAdminSessionTransaction implements AdminSessionTransaction {
  constructor(private readonly store: FakeAdminSessionStore) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return Promise.resolve(
      this.store.attempts.filter(
        (attempt) => attempt.key === key && attempt.at.getTime() >= since.getTime(),
      ).length,
    );
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    this.store.attempts.push({ key, at });
    return Promise.resolve();
  }

  findAdminAccountByEmail(email: string): Promise<AdminAccount | null> {
    return Promise.resolve(
      this.store.accounts.find((account) => account.email === email && account.active) ?? null,
    );
  }

  findAdminAccountById(accountId: string): Promise<AdminAccount | null> {
    return Promise.resolve(
      this.store.accounts.find((account) => account.id === accountId && account.active) ?? null,
    );
  }

  registerFailedSignIn(accountId: string, threshold: number, at: Date): Promise<void> {
    const index = this.store.accounts.findIndex((account) => account.id === accountId);
    if (index === -1) return Promise.resolve();
    const account = this.store.accounts[index];
    const failedAttempts = account.failedAttempts + 1;
    this.store.accounts[index] = {
      ...account,
      failedAttempts,
      lockedAt: failedAttempts >= threshold ? at : account.lockedAt,
    };
    return Promise.resolve();
  }

  clearFailedSignIns(accountId: string): Promise<void> {
    const index = this.store.accounts.findIndex((account) => account.id === accountId);
    if (index !== -1) {
      this.store.accounts[index] = { ...this.store.accounts[index], failedAttempts: 0 };
    }
    return Promise.resolve();
  }

  createSession(
    accountId: string,
    refreshTokenHash: Buffer,
    at: Date,
  ): Promise<AdminSession> {
    const session: FakeAdminSession = {
      id: this.store.mintId(),
      accountId,
      createdAt: at,
      revokedAt: null,
      revokedReason: null,
    };
    this.store.sessions.push(session);
    this.store.refreshTokens.push({
      id: this.store.mintId(),
      sessionId: session.id,
      tokenHash: refreshTokenHash,
      issuedAt: at,
      consumedAt: null,
    });
    return Promise.resolve({
      id: session.id,
      accountId: session.accountId,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt,
    });
  }

  findRefreshToken(tokenHash: Buffer): Promise<PresentedAdminRefreshToken | null> {
    const token = this.store.refreshTokens.find((candidate) =>
      candidate.tokenHash.equals(tokenHash),
    );
    if (!token) return Promise.resolve(null);
    const session = this.store.sessions.find((candidate) => candidate.id === token.sessionId);
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
  }

  consumeRefreshToken(tokenId: string, at: Date): Promise<boolean> {
    const token = this.store.refreshTokens.find((candidate) => candidate.id === tokenId);
    if (!token || token.consumedAt !== null) return Promise.resolve(false);
    token.consumedAt = at;
    return Promise.resolve(true);
  }

  issueRefreshToken(sessionId: string, tokenHash: Buffer, at: Date): Promise<void> {
    this.store.refreshTokens.push({
      id: this.store.mintId(),
      sessionId,
      tokenHash,
      issuedAt: at,
      consumedAt: null,
    });
    return Promise.resolve();
  }

  revokeSession(
    sessionId: string,
    reason: AdminSessionRevokedReason,
    at: Date,
  ): Promise<void> {
    const session = this.store.sessions.find((candidate) => candidate.id === sessionId);
    if (session && session.revokedAt === null) {
      session.revokedAt = at;
      session.revokedReason = reason;
    }
    return Promise.resolve();
  }
}
