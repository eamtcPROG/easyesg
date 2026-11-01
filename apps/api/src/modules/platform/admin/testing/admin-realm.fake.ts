import type { AdminInvitationIssued } from '../constants/admin-invitation.constants';
import { AdminAccountExistsError } from '../errors/admin-accounts.errors';
import { AdminInvitationOutstandingError } from '../errors/admin-invitation.errors';
import type {
  AdminAccountStore,
  AdminAccountTransaction,
} from '../interfaces/admin-account-store.interface';
import type {
  AdminInvitationBearerStore,
  AdminInvitationBearerTransaction,
} from '../interfaces/admin-invitation-bearer-store.interface';
import {
  ADMIN_INVITATION_STATUS,
  type AdminInvitation,
  type PresentedAdminInvitation,
} from '../models/admin-invitation.model';
import type { AdminAccountRecord, AdminRoster } from '../models/admin-roster.model';
import {
  ADMIN_ACCOUNT_STATUS,
  ADMIN_ROLE,
  type AdminAccountStatus,
  type AdminRole,
  type AdminSessionRevokedReason,
} from '../models/admin-session.model';

/**
 * The admin realm's accounts, invitations and sessions in memory (task 67.4) — one state behind both
 * of A-08's ports, since the two adapters read one set of tables.
 *
 * **It models rollback**, `FakeAdminSessionStore`'s discipline: a unit of work that throws leaves the
 * state as it found it, so a spec can assert *a refused collision spends no budget* rather than only
 * that an error was raised. Rows are replaced, never mutated, so a snapshot is a copy of the arrays.
 *
 * **It models the two database rules the use cases lean on**: the partial unique index on a pending
 * address, and the one on a live account's address — each refused the way the adapter refuses it.
 */
export interface FakeRealmAccount extends AdminAccountRecord {
  readonly lastSignInAt: Date | null;
  /** What acceptance wrote; null for an account a spec seeded without a credential it never reads. */
  readonly passwordHash: string | null;
  readonly totpSecret: string | null;
}

export interface FakeRealmInvitation extends AdminInvitation {
  readonly tokenHash: Buffer;
  readonly stagedTotpSecret: string | null;
  readonly invitedBy: string;
}

export interface FakeRealmSession {
  readonly id: string;
  readonly accountId: string;
  readonly revokedAt: Date | null;
  readonly revokedReason: AdminSessionRevokedReason | null;
}

interface Snapshot {
  readonly accounts: FakeRealmAccount[];
  readonly invitations: FakeRealmInvitation[];
  readonly sessions: FakeRealmSession[];
  readonly attempts: { key: string; at: Date }[];
  readonly emails: { event: AdminInvitationIssued; expiresAt: Date }[];
}

export class FakeAdminRealm {
  accounts: FakeRealmAccount[] = [];
  invitations: FakeRealmInvitation[] = [];
  sessions: FakeRealmSession[] = [];
  attempts: { key: string; at: Date }[] = [];
  emails: { event: AdminInvitationIssued; expiresAt: Date }[] = [];
  rollbacks = 0;

  private nextId = 1;

  readonly accountStore: AdminAccountStore = {
    run: (work) => this.transact(() => work(new FakeAccountTransaction(this))),
  };

  readonly bearerStore: AdminInvitationBearerStore = {
    run: (work) => this.transact(() => work(new FakeBearerTransaction(this))),
  };

  mintId(): string {
    const id = this.nextId.toString().padStart(12, '0');
    this.nextId += 1;
    return `00000000-0000-7000-8000-${id}`;
  }

  /** Seeds an account, active Platform Administrator unless told otherwise. */
  seedAccount(overrides: Partial<FakeRealmAccount> & Pick<FakeRealmAccount, 'email'>): FakeRealmAccount {
    const account: FakeRealmAccount = {
      id: this.mintId(),
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      status: ADMIN_ACCOUNT_STATUS.ACTIVE,
      lockedAt: null,
      lastSignInAt: null,
      passwordHash: null,
      totpSecret: null,
      ...overrides,
    };
    this.accounts.push(account);
    return account;
  }

  seedSession(accountId: string, revoked?: { at: Date; reason: AdminSessionRevokedReason }): FakeRealmSession {
    const session: FakeRealmSession = {
      id: this.mintId(),
      accountId,
      revokedAt: revoked?.at ?? null,
      revokedReason: revoked?.reason ?? null,
    };
    this.sessions.push(session);
    return session;
  }

  accountById(accountId: string): FakeRealmAccount | undefined {
    return this.accounts.find((account) => account.id === accountId);
  }

  private async transact<T>(work: () => Promise<T>): Promise<T> {
    const snapshot: Snapshot = {
      accounts: [...this.accounts],
      invitations: [...this.invitations],
      sessions: [...this.sessions],
      attempts: [...this.attempts],
      emails: [...this.emails],
    };
    try {
      return await work();
    } catch (error) {
      this.accounts = snapshot.accounts;
      this.invitations = snapshot.invitations;
      this.sessions = snapshot.sessions;
      this.attempts = snapshot.attempts;
      this.emails = snapshot.emails;
      this.rollbacks += 1;
      throw error;
    }
  }
}

const liveAccountHolds = (realm: FakeAdminRealm, email: string): boolean =>
  realm.accounts.some(
    (account) => account.email === email && account.status !== ADMIN_ACCOUNT_STATUS.REMOVED,
  );

const publicInvitation = (invitation: FakeRealmInvitation): AdminInvitation => ({
  id: invitation.id,
  email: invitation.email,
  role: invitation.role,
  status: invitation.status,
  issuedAt: invitation.issuedAt,
  expiresAt: invitation.expiresAt,
});

class FakeAttempts {
  constructor(protected readonly realm: FakeAdminRealm) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return Promise.resolve(
      this.realm.attempts.filter((attempt) => attempt.key === key && attempt.at >= since).length,
    );
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    this.realm.attempts.push({ key, at });
    return Promise.resolve();
  }
}

class FakeAccountTransaction extends FakeAttempts implements AdminAccountTransaction {
  readRoster(): Promise<AdminRoster> {
    const byEmail = (a: { email: string }, b: { email: string }) => a.email.localeCompare(b.email);
    return Promise.resolve({
      accounts: [...this.realm.accounts].sort(byEmail).map((account) => ({
        id: account.id,
        email: account.email,
        role: account.role,
        status: account.status,
        lockedAt: account.lockedAt,
        lastSignInAt: account.lastSignInAt,
      })),
      invitations: this.realm.invitations
        .filter((invitation) => invitation.status === ADMIN_INVITATION_STATUS.PENDING)
        .sort(byEmail)
        .map(publicInvitation),
    });
  }

  findAccount(accountId: string): Promise<AdminAccountRecord | null> {
    const account = this.realm.accountById(accountId);
    return Promise.resolve(
      account === undefined
        ? null
        : {
            id: account.id,
            email: account.email,
            role: account.role,
            status: account.status,
            lockedAt: account.lockedAt,
          },
    );
  }

  countActivePlatformAdministratorsUnderLock(): Promise<number> {
    return Promise.resolve(
      this.realm.accounts.filter(
        (account) =>
          account.role === ADMIN_ROLE.PLATFORM_ADMINISTRATOR &&
          account.status === ADMIN_ACCOUNT_STATUS.ACTIVE,
      ).length,
    );
  }

  changeStatus(input: {
    readonly accountId: string;
    readonly from: readonly AdminAccountStatus[];
    readonly to: AdminAccountStatus;
  }): Promise<boolean> {
    const account = this.realm.accountById(input.accountId);
    if (account === undefined || !input.from.includes(account.status)) return Promise.resolve(false);
    this.realm.accounts = this.realm.accounts.map((candidate) =>
      candidate.id === account.id ? { ...candidate, status: input.to } : candidate,
    );
    return Promise.resolve(true);
  }

  revokeSessions(input: {
    readonly accountId: string;
    readonly reason: AdminSessionRevokedReason;
    readonly at: Date;
  }): Promise<void> {
    this.realm.sessions = this.realm.sessions.map((session) =>
      session.accountId === input.accountId && session.revokedAt === null
        ? { ...session, revokedAt: input.at, revokedReason: input.reason }
        : session,
    );
    return Promise.resolve();
  }

  releaseLockout(input: { readonly accountId: string }): Promise<boolean> {
    const account = this.realm.accountById(input.accountId);
    if (
      account === undefined ||
      account.lockedAt === null ||
      account.status === ADMIN_ACCOUNT_STATUS.REMOVED
    ) {
      return Promise.resolve(false);
    }
    this.realm.accounts = this.realm.accounts.map((candidate) =>
      candidate.id === account.id ? { ...candidate, lockedAt: null } : candidate,
    );
    return Promise.resolve(true);
  }

  hasLiveAccountWithEmail(email: string): Promise<boolean> {
    return Promise.resolve(liveAccountHolds(this.realm, email));
  }

  issueInvitation(input: {
    readonly email: string;
    readonly role: AdminRole;
    readonly invitedBy: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<AdminInvitation> {
    // `admin_invitation_pending_email_key`, modelled.
    if (
      this.realm.invitations.some(
        (invitation) =>
          invitation.email === input.email && invitation.status === ADMIN_INVITATION_STATUS.PENDING,
      )
    ) {
      return Promise.reject(new AdminInvitationOutstandingError());
    }

    const invitation: FakeRealmInvitation = {
      id: this.realm.mintId(),
      email: input.email,
      role: input.role,
      status: ADMIN_INVITATION_STATUS.PENDING,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      tokenHash: input.tokenHash,
      stagedTotpSecret: null,
      invitedBy: input.invitedBy,
    };
    this.realm.invitations.push(invitation);
    return Promise.resolve(publicInvitation(invitation));
  }

  findInvitation(invitationId: string): Promise<AdminInvitation | null> {
    const invitation = this.realm.invitations.find((candidate) => candidate.id === invitationId);
    return Promise.resolve(invitation === undefined ? null : publicInvitation(invitation));
  }

  reissueInvitationToken(input: {
    readonly invitationId: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<boolean> {
    return Promise.resolve(
      this.updatePending(input.invitationId, (invitation) => ({
        ...invitation,
        tokenHash: input.tokenHash,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
        stagedTotpSecret: null,
      })),
    );
  }

  revokeInvitation(input: { readonly invitationId: string }): Promise<boolean> {
    return Promise.resolve(
      this.updatePending(input.invitationId, (invitation) => ({
        ...invitation,
        status: ADMIN_INVITATION_STATUS.REVOKED,
      })),
    );
  }

  emitInvitationEmail(input: { readonly event: AdminInvitationIssued; readonly expiresAt: Date }): Promise<void> {
    this.realm.emails.push({ event: input.event, expiresAt: input.expiresAt });
    return Promise.resolve();
  }

  private updatePending(
    invitationId: string,
    change: (invitation: FakeRealmInvitation) => FakeRealmInvitation,
  ): boolean {
    const found = this.realm.invitations.find(
      (invitation) =>
        invitation.id === invitationId && invitation.status === ADMIN_INVITATION_STATUS.PENDING,
    );
    if (found === undefined) return false;
    this.realm.invitations = this.realm.invitations.map((invitation) =>
      invitation.id === invitationId ? change(invitation) : invitation,
    );
    return true;
  }
}

class FakeBearerTransaction extends FakeAttempts implements AdminInvitationBearerTransaction {
  findInvitationByTokenHash(tokenHash: Buffer): Promise<PresentedAdminInvitation | null> {
    const invitation = this.realm.invitations.find((candidate) => candidate.tokenHash.equals(tokenHash));
    return Promise.resolve(
      invitation === undefined
        ? null
        : { ...publicInvitation(invitation), stagedTotpSecret: invitation.stagedTotpSecret },
    );
  }

  stageTotpSecret(input: { readonly invitationId: string; readonly secret: string }): Promise<string | null> {
    const invitation = this.realm.invitations.find(
      (candidate) =>
        candidate.id === input.invitationId && candidate.status === ADMIN_INVITATION_STATUS.PENDING,
    );
    if (invitation === undefined) return Promise.resolve(null);

    // The adapter's `COALESCE`: a secret already staged is kept.
    const staged = invitation.stagedTotpSecret ?? input.secret;
    this.realm.invitations = this.realm.invitations.map((candidate) =>
      candidate.id === invitation.id ? { ...candidate, stagedTotpSecret: staged } : candidate,
    );
    return Promise.resolve(staged);
  }

  accept(input: {
    readonly invitationId: string;
    readonly email: string;
    readonly role: AdminRole;
    readonly passwordHash: string;
    readonly totpSecret: string;
  }): Promise<string | null> {
    const invitation = this.realm.invitations.find(
      (candidate) =>
        candidate.id === input.invitationId && candidate.status === ADMIN_INVITATION_STATUS.PENDING,
    );
    if (invitation === undefined) return Promise.resolve(null);

    this.realm.invitations = this.realm.invitations.map((candidate) =>
      candidate.id === invitation.id ? { ...candidate, status: ADMIN_INVITATION_STATUS.ACCEPTED } : candidate,
    );
    // `admin_account_live_email_key`, modelled — thrown inside the unit of work, so the claim above
    // rolls back with it, as the adapter's does.
    if (liveAccountHolds(this.realm, input.email)) return Promise.reject(new AdminAccountExistsError());

    const account = this.realm.seedAccount({
      email: input.email,
      role: input.role,
      passwordHash: input.passwordHash,
      totpSecret: input.totpSecret,
    });
    return Promise.resolve(account.id);
  }
}
