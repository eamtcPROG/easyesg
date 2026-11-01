import type {
  AdminCredentialStore,
  AdminCredentialTransaction,
  AdminOperatorCredential,
} from '../interfaces/admin-credential-store.interface';
import type { AdminCredentialState } from '../models/admin-credentials.model';
import {
  ADMIN_ACCOUNT_STATUS,
  type AdminAccountStatus,
  type AdminSessionRevokedReason,
} from '../models/admin-session.model';

/**
 * A-19's store in memory (task 144) — `FakeAdminRealm`'s discipline. **It models rollback**, so a spec can
 * assert that a refused confirmation spent its window and changed nothing else; rows are replaced, never
 * mutated, so a snapshot is a copy of the arrays.
 *
 * **It models the adapter's conditional rules**: only an active account answers or takes a staging, and a
 * promotion moves the staged secret into force and clears it in one step.
 */
export interface FakeCredentialAccount {
  readonly id: string;
  readonly email: string;
  readonly status: AdminAccountStatus;
  readonly passwordHash: string;
  readonly totpSecret: string;
  readonly stagedTotpSecret: string | null;
}

export interface FakeCredentialSession {
  readonly id: string;
  readonly accountId: string;
  readonly revokedAt: Date | null;
  readonly revokedReason: AdminSessionRevokedReason | null;
}

export interface FakeCredentialRecoveryCode {
  readonly accountId: string;
  readonly codeHash: Buffer;
  readonly issuedAt: Date;
  readonly spentAt: Date | null;
}

export class FakeAdminCredentialStore implements AdminCredentialStore {
  accounts: FakeCredentialAccount[] = [];
  sessions: FakeCredentialSession[] = [];
  recoveryCodes: FakeCredentialRecoveryCode[] = [];
  attempts: { key: string; at: Date }[] = [];
  rollbacks = 0;

  private nextId = 1;

  async run<T>(work: (tx: AdminCredentialTransaction) => Promise<T>): Promise<T> {
    const snapshot = {
      accounts: [...this.accounts],
      sessions: [...this.sessions],
      recoveryCodes: [...this.recoveryCodes],
      attempts: [...this.attempts],
    };
    try {
      return await work(new FakeCredentialTransaction(this));
    } catch (error) {
      this.accounts = snapshot.accounts;
      this.sessions = snapshot.sessions;
      this.recoveryCodes = snapshot.recoveryCodes;
      this.attempts = snapshot.attempts;
      this.rollbacks += 1;
      throw error;
    }
  }

  mintId(): string {
    const id = this.nextId.toString().padStart(12, '0');
    this.nextId += 1;
    return `00000000-0000-7000-8000-${id}`;
  }

  /** Seeds an active operator whose password digest is `hashed:Parola123!` unless told otherwise. */
  seedAccount(overrides: Partial<FakeCredentialAccount> = {}): FakeCredentialAccount {
    const id = this.mintId();
    const account: FakeCredentialAccount = {
      id,
      email: `operator-${id.slice(-4)}@easyesg.md`,
      status: ADMIN_ACCOUNT_STATUS.ACTIVE,
      passwordHash: 'hashed:Parola123!',
      totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      stagedTotpSecret: null,
      ...overrides,
    };
    this.accounts = [...this.accounts, account];
    return account;
  }

  seedSession(input: Pick<FakeCredentialSession, 'accountId'> & Partial<FakeCredentialSession>): FakeCredentialSession {
    const session: FakeCredentialSession = {
      id: this.mintId(),
      revokedAt: null,
      revokedReason: null,
      ...input,
    };
    this.sessions = [...this.sessions, session];
    return session;
  }

  accountById(accountId: string): FakeCredentialAccount | undefined {
    return this.accounts.find((account) => account.id === accountId);
  }
}

class FakeCredentialTransaction implements AdminCredentialTransaction {
  constructor(private readonly store: FakeAdminCredentialStore) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return Promise.resolve(
      this.store.attempts.filter((attempt) => attempt.key === key && attempt.at >= since).length,
    );
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    this.store.attempts = [...this.store.attempts, { key, at }];
    return Promise.resolve();
  }

  findCredential(accountId: string): Promise<AdminOperatorCredential | null> {
    const account = this.activeAccount(accountId);
    return Promise.resolve(
      account === undefined ? null : { email: account.email, passwordHash: account.passwordHash },
    );
  }

  replacePassword(input: { readonly accountId: string; readonly passwordHash: string }): Promise<void> {
    this.replaceAccount(input.accountId, (account) => ({ ...account, passwordHash: input.passwordHash }));
    return Promise.resolve();
  }

  revokeOtherSessions(input: {
    readonly accountId: string;
    readonly exceptSessionId: string;
    readonly reason: AdminSessionRevokedReason;
    readonly at: Date;
  }): Promise<number> {
    const ending = (session: FakeCredentialSession) =>
      session.accountId === input.accountId &&
      session.id !== input.exceptSessionId &&
      session.revokedAt === null;

    const terminated = this.store.sessions.filter(ending).length;
    this.store.sessions = this.store.sessions.map((session) =>
      ending(session) ? { ...session, revokedAt: input.at, revokedReason: input.reason } : session,
    );
    return Promise.resolve(terminated);
  }

  stageTotpSecret(input: { readonly accountId: string; readonly secret: string }): Promise<boolean> {
    if (this.activeAccount(input.accountId) === undefined) return Promise.resolve(false);
    this.replaceAccount(input.accountId, (account) => ({ ...account, stagedTotpSecret: input.secret }));
    return Promise.resolve(true);
  }

  findStagedTotpSecretForUpdate(accountId: string): Promise<string | null> {
    return Promise.resolve(this.activeAccount(accountId)?.stagedTotpSecret ?? null);
  }

  promoteStagedTotpSecret(input: { readonly accountId: string }): Promise<void> {
    this.replaceAccount(input.accountId, (account) =>
      account.stagedTotpSecret === null
        ? account
        : { ...account, totpSecret: account.stagedTotpSecret, stagedTotpSecret: null },
    );
    return Promise.resolve();
  }

  replaceRecoveryCodes(input: {
    readonly accountId: string;
    readonly hashes: readonly Buffer[];
    readonly at: Date;
  }): Promise<void> {
    this.store.recoveryCodes = [
      ...this.store.recoveryCodes.filter((code) => code.accountId !== input.accountId),
      ...input.hashes.map((codeHash) => ({
        accountId: input.accountId,
        codeHash,
        issuedAt: input.at,
        spentAt: null,
      })),
    ];
    return Promise.resolve();
  }

  readCredentialState(accountId: string): Promise<AdminCredentialState> {
    const codes = this.store.recoveryCodes.filter((code) => code.accountId === accountId);
    return Promise.resolve({
      recoveryCodesIssuedAt: codes[0]?.issuedAt ?? null,
      recoveryCodesRemaining: codes.filter((code) => code.spentAt === null).length,
    });
  }

  private activeAccount(accountId: string): FakeCredentialAccount | undefined {
    const account = this.store.accountById(accountId);
    return account?.status === ADMIN_ACCOUNT_STATUS.ACTIVE ? account : undefined;
  }

  private replaceAccount(
    accountId: string,
    change: (account: FakeCredentialAccount) => FakeCredentialAccount,
  ): void {
    this.store.accounts = this.store.accounts.map((account) =>
      account.id === accountId ? change(account) : account,
    );
  }
}
