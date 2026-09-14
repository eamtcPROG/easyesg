import type { AdminInvitation } from './admin-invitation.model';
import type { AdminAccountStatus, AdminRole } from './admin-session.model';

/**
 * A-08's account table (task 67.4; UC-87) — accounts and pending invitations in one list, as the
 * artboard draws them, because an invited operator is someone a Platform Administrator is responsible
 * for from the moment the invitation leaves. S-16's union of members and invitations is the tenant
 * precedent.
 */

export const ADMIN_ROSTER_KIND = {
  ACCOUNT: 'account',
  INVITATION: 'invitation',
} as const;

export type AdminRosterKind = (typeof ADMIN_ROSTER_KIND)[keyof typeof ADMIN_ROSTER_KIND];

/**
 * What the state column says. **Derived, never stored** (`domain/admin-standing.ts`): an account's
 * status and its lockout are two facts, and an invitation's lapse is the clock's — so one word per
 * row is a reading of those facts rather than a column that could disagree with them.
 */
export const ADMIN_STANDING = {
  ACTIVE: 'active',
  /** Active, and locked after repeated failures — the one standing a lockout release applies to. */
  LOCKED: 'locked',
  SUSPENDED: 'suspended',
  REMOVED: 'removed',
  INVITED: 'invited',
  /** Pending past its expiry. Resending restores a working link; it still holds the address. */
  LAPSED: 'lapsed',
} as const;

export type AdminStanding = (typeof ADMIN_STANDING)[keyof typeof ADMIN_STANDING];

/** The facts a lifecycle change is judged against — no credential, which no change needs. */
export interface AdminAccountRecord {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly status: AdminAccountStatus;
  readonly lockedAt: Date | null;
}

export interface AdminRosterAccount extends AdminAccountRecord {
  /** The most recent session opened — sign-in, not activity, as A-02's column is. */
  readonly lastSignInAt: Date | null;
}

/** What the store reads: each half already in its display order, which is a collation (OQ-61). */
export interface AdminRoster {
  readonly accounts: readonly AdminRosterAccount[];
  /** Pending only — an accepted invitation is its account, and a revoked one is nobody. */
  readonly invitations: readonly AdminInvitation[];
}

export interface AdminRosterRow {
  /** The account's id, or the invitation's — `kind` says which a control acts on. */
  readonly id: string;
  readonly kind: AdminRosterKind;
  readonly email: string;
  readonly role: AdminRole;
  readonly standing: AdminStanding;
  readonly lastSignInAt: Date | null;
  /** An invitation's expiry; null for an account. */
  readonly expiresAt: Date | null;
}
