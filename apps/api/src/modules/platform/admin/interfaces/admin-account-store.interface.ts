import type { AuthAttemptRecorder } from '@api/modules/identity/account/domain/auth-throttle';
import type { AdminInvitationIssued } from '../constants/admin-invitation.constants';
import type { AdminInvitation } from '../models/admin-invitation.model';
import type { AdminAccountRecord, AdminRoster } from '../models/admin-roster.model';
import type {
  AdminAccountStatus,
  AdminRole,
  AdminSessionRevokedReason,
} from '../models/admin-session.model';

/**
 * A-08's store — the accounts, their lifecycle and their invitations (task 67.4; UC-87).
 *
 * **A unit of work, like `AdminSessionStore`, and not the request's transaction**: the admin realm
 * binds no tenant, so there is no request transaction to join. Each use case runs one `run`, and a
 * refusal thrown inside it rolls back everything it wrote — which is right for every refusal here,
 * since none of them is an attempt that must durably count (the bearer store's are, and it says so).
 *
 * **Separate from the session store** because it serves a different reader: A-08 acts on *other*
 * accounts and never opens a credential, and a port offering both would hand the lifecycle's use
 * cases the TOTP secret they have no use for.
 */
export interface AdminAccountTransaction extends AuthAttemptRecorder {
  /** Every account, removed ones included, and every pending invitation — each half in display order. */
  readRoster(): Promise<AdminRoster>;

  findAccount(accountId: string): Promise<AdminAccountRecord | null>;

  /**
   * Takes the realm's lifecycle lock for the rest of the transaction, then counts the active Platform
   * Administrators — FR-60's counter, under a lock so two administrators suspending each other at
   * once cannot both see two. Every status change calls it, which is what makes them serialise.
   */
  countActivePlatformAdministratorsUnderLock(): Promise<number>;

  /** A conditional write: false when the account was not in one of `from`, which a race produces. */
  changeStatus(input: {
    readonly accountId: string;
    readonly from: readonly AdminAccountStatus[];
    readonly to: AdminAccountStatus;
    readonly at: Date;
  }): Promise<boolean>;

  /** Ends every session of the account still live; a session already ended keeps its reason. */
  revokeSessions(input: {
    readonly accountId: string;
    readonly reason: AdminSessionRevokedReason;
    readonly at: Date;
  }): Promise<void>;

  /** Clears the lockout and the failure count; false when the account was not locked. */
  releaseLockout(input: { readonly accountId: string; readonly at: Date }): Promise<boolean>;

  /** Whether an account that is not removed holds the address — what an invitation may not duplicate. */
  hasLiveAccountWithEmail(email: string): Promise<boolean>;

  /** Throws `AdminInvitationOutstandingError` when the address already carries a pending invitation. */
  issueInvitation(input: {
    readonly email: string;
    readonly role: AdminRole;
    readonly invitedBy: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<AdminInvitation>;

  findInvitation(invitationId: string): Promise<AdminInvitation | null>;

  /**
   * Rotates a pending invitation's token and restarts its window, **and clears any staged secret**:
   * the replaced link's bearer may have staged one, and it must not survive into the new link's
   * enrolment. False when the invitation is no longer pending.
   */
  reissueInvitationToken(input: {
    readonly invitationId: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<boolean>;

  /** False when the invitation is no longer pending. */
  revokeInvitation(input: { readonly invitationId: string; readonly at: Date }): Promise<boolean>;

  /** The email's outbox row, in this transaction — the invitation and its mail commit together (P-8). */
  emitInvitationEmail(input: {
    readonly event: AdminInvitationIssued;
    readonly expiresAt: Date;
  }): Promise<void>;
}

export interface AdminAccountStore {
  run<T>(work: (tx: AdminAccountTransaction) => Promise<T>): Promise<T>;
}

export const ADMIN_ACCOUNT_STORE = Symbol('ADMIN_ACCOUNT_STORE');
