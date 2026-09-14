import type { AdminRole } from './admin-session.model';

/**
 * An administrator invitation (task 67.4; UC-87; `architecture.md` §12.5.6's task-67.4 row) — how an
 * operator account comes into existence from the console.
 *
 * **Its own model over its own table, not an account with its credentials missing.** Every
 * `AdminAccount` holds a password and a confirmed second factor, and that stays true because only
 * the acceptance that sets both creates one; what is optional — an address invited, a secret staged
 * and not yet confirmed — lives here.
 */

/** The `admin_invitation_status_known` CHECK's vocabulary. Lapsing is the clock's, never stored. */
export const ADMIN_INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REVOKED: 'revoked',
} as const;

export type AdminInvitationStatus =
  (typeof ADMIN_INVITATION_STATUS)[keyof typeof ADMIN_INVITATION_STATUS];

/** `isAdminRole`'s reason: an unknown value is refused, never mapped to a member. */
export const isAdminInvitationStatus = (value: unknown): value is AdminInvitationStatus =>
  typeof value === 'string' &&
  (Object.values(ADMIN_INVITATION_STATUS) as readonly string[]).includes(value);

export interface AdminInvitation {
  readonly id: string;
  /** Lower-cased and trimmed — the address the link was sent to and the account will hold. */
  readonly email: string;
  /** The realm acceptance creates the account in. Fixed at issue: realms are not changed later. */
  readonly role: AdminRole;
  readonly status: AdminInvitationStatus;
  /** The most recent issue or resend — a resend moves it with the token. */
  readonly issuedAt: Date;
  readonly expiresAt: Date;
}

/**
 * An invitation as its link's bearer meets it, with the factor staged for it — opened by the store
 * adapter, like the account's secret, so no use case learns the column is sealed.
 */
export interface PresentedAdminInvitation extends AdminInvitation {
  /** Base32, per `domain/totp.ts`. Null until the bearer asks for one; cleared by a resend. */
  readonly stagedTotpSecret: string | null;
}
