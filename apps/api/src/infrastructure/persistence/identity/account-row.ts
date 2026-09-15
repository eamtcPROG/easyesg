import { toLocale } from '@easyesg/i18n';
import type { Account } from '@api/modules/identity/account/models/account.model';

/**
 * An `identity.account` row, its column list and its mapping to the model — one copy for every
 * identity adapter that reads the table (task 155).
 *
 * **It was three copies**, in the account, session and social sign-in stores, each carrying the same
 * interface, mapper and column list. Task 155 needed a column added to all three and a fourth adapter
 * reading it, which is the point at which a copy per adapter stops being locally correct and becomes
 * four places to forget a field — the case CLAUDE.md's "search for its shape" rule names.
 */

/** As PostgreSQL returns it: snake_case, and `timestamptz` already parsed to `Date` by `pg`. */
export interface AccountRow {
  id: string;
  email: string;
  status: string;
  locale: string;
  given_name: string | null;
  family_name: string | null;
  verified_at: Date | null;
  setup_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const ACCOUNT_COLUMNS =
  'id, email, status, locale, given_name, family_name, verified_at, setup_expires_at, created_at, updated_at';

export const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  email: row.email,
  // The CHECK constraint `account_status_known` is what makes this narrowing safe; it is asserted
  // rather than re-validated because a status the database rejects cannot be in a row.
  status: row.status as Account['status'],
  locale: toLocale(row.locale),
  givenName: row.given_name,
  familyName: row.family_name,
  verifiedAt: row.verified_at,
  setupExpiresAt: row.setup_expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
