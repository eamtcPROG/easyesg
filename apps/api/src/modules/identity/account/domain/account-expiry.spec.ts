import { UNVERIFIED_ACCOUNT_TTL_MS, unverifiedAccountHasExpired } from './account-expiry';
import type { Account } from '../models/account.model';

/** OQ-52, closed 20 Aug 2026: seven days, and the account record is deleted. */
describe('unverified account expiry (FR-3, OQ-52)', () => {
  const NOW = new Date('2026-08-20T09:00:00.000Z');

  const accountCreated = (at: Date, status: Account['status'] = 'unverified'): Account => ({
    id: 'account-1',
    email: 'ana@example.md',
    status,
    locale: 'ro',
    verifiedAt: status === 'active' ? at : null,
    createdAt: at,
    updatedAt: at,
  });

  it('is seven days, which is seven times the link lifetime', () => {
    expect(UNVERIFIED_ACCOUNT_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('has not expired one millisecond before the window closes', () => {
    const created = new Date(NOW.getTime() - UNVERIFIED_ACCOUNT_TTL_MS + 1);
    expect(unverifiedAccountHasExpired(accountCreated(created), NOW)).toBe(false);
  });

  it('has expired exactly at the window', () => {
    const created = new Date(NOW.getTime() - UNVERIFIED_ACCOUNT_TTL_MS);
    expect(unverifiedAccountHasExpired(accountCreated(created), NOW)).toBe(true);
  });

  /**
   * The case that would be catastrophic and is trivially easy to write: a rule that looked only at
   * `created_at` would expire every account a week after registration, verified or not, and the
   * symptom would be customers losing accounts mid-filing-season.
   */
  it('never expires an active account, however old', () => {
    const created = new Date(NOW.getTime() - 10 * UNVERIFIED_ACCOUNT_TTL_MS);
    expect(unverifiedAccountHasExpired(accountCreated(created, 'active'), NOW)).toBe(false);
  });
});
