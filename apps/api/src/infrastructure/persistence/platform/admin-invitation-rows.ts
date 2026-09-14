import {
  isAdminInvitationStatus,
  type AdminInvitation,
} from '@api/modules/platform/admin/models/admin-invitation.model';
import { isAdminRole } from '@api/modules/platform/admin/models/admin-session.model';

/**
 * `identity.admin_invitation` as both of its stores read it (task 67.4) — A-08's account store and
 * A-20's bearer store — so the column list and the narrowing exist once rather than once per adapter.
 */

export const ADMIN_INVITATION_COLUMNS = 'id, email, role, status, issued_at, expires_at';

/** Rows as PostgreSQL returns them: snake_case, `timestamptz` parsed to `Date` by `pg`. */
export interface AdminInvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  issued_at: Date;
  expires_at: Date;
}

/**
 * **A role or status outside the vocabulary reads as no invitation** — the session store's rule for
 * an unknown role (task 145): the `CHECK` makes the value impossible today, and an expand→migrate step
 * is when it would not be, at which point defaulting it would hand out whatever the default carries.
 */
export const toAdminInvitation = (row: AdminInvitationRow): AdminInvitation | null =>
  isAdminRole(row.role) && isAdminInvitationStatus(row.status)
    ? {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
      }
    : null;

/** PostgreSQL's SQLSTATE for a unique violation. */
const UNIQUE_VIOLATION = '23505';

/** A unique violation raised by the named index — how an index rather than a prior read refuses a duplicate. */
export const violatesUniqueIndex = (input: { readonly error: unknown; readonly index: string }): boolean => {
  const driverError = (input.error as { driverError?: { code?: string; constraint?: string } })
    .driverError;
  return driverError?.code === UNIQUE_VIOLATION && driverError.constraint === input.index;
};
