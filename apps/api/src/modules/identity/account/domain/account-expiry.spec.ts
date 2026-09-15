import {
  UNVERIFIED_ACCOUNT_TTL_MS,
  accountHasLapsed,
  setupDeadlineFor,
  setupHasLapsed,
  unverifiedAccountHasExpired,
} from './account-expiry';
import type { Account } from '../models/account.model';

const NOW = new Date('2026-08-20T09:00:00.000Z');

/** OQ-52, closed 20 Aug 2026: seven days, and the account record is deleted. */
describe('unverified account expiry (FR-3, OQ-52)', () => {
  const accountCreated = (at: Date, status: Account['status'] = 'unverified'): Account => ({
    id: 'account-1',
    email: 'ana@example.md',
    status,
    locale: 'ro',
    givenName: null,
    familyName: null,
    verifiedAt: status === 'active' ? at : null,
    setupExpiresAt: null,
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

/** Task 155 (§12.5.6's task-155 row (3)): an abandoned setup is deleted seven days after registration. */
describe('abandoned setup (task 155)', () => {
  const inSetup = (setupExpiresAt: Date | null): Account => ({
    id: 'account-1',
    email: 'ana@example.md',
    status: 'awaiting_setup',
    locale: 'ro',
    givenName: 'Ana Popescu',
    familyName: null,
    verifiedAt: new Date('2026-08-15T09:00:00.000Z'),
    setupExpiresAt,
    createdAt: new Date('2026-08-15T09:00:00.000Z'),
    updatedAt: new Date('2026-08-15T09:00:00.000Z'),
  });

  it('gives the deadline seven days after registration, not after the address was confirmed', () => {
    expect(setupDeadlineFor({ createdAt: new Date('2026-08-15T09:00:00.000Z') })).toEqual(
      new Date('2026-08-22T09:00:00.000Z'),
    );
  });

  it('has not lapsed one millisecond before its deadline', () => {
    expect(setupHasLapsed(inSetup(new Date(NOW.getTime() + 1)), NOW)).toBe(false);
  });

  it('has lapsed exactly at its deadline', () => {
    expect(setupHasLapsed(inSetup(NOW), NOW)).toBe(true);
  });

  /** The owner's decision (3): a moved account may hold organizations, and must survive any age. */
  it('never lapses an account moved into setup, which carries no deadline', () => {
    expect(setupHasLapsed(inSetup(null), new Date(NOW.getTime() + 100 * UNVERIFIED_ACCOUNT_TTL_MS))).toBe(
      false,
    );
  });

  it('reads the status, so a deadline on an account outside setup lapses nothing', () => {
    expect(setupHasLapsed({ status: 'active', setupExpiresAt: new Date(NOW.getTime() - 1) }, NOW)).toBe(false);
  });

  it('treats either abandonment as no account, and neither kind of live account as one', () => {
    const unverified: Account = {
      ...inSetup(null),
      status: 'unverified',
      verifiedAt: null,
      createdAt: new Date(NOW.getTime() - UNVERIFIED_ACCOUNT_TTL_MS),
    };
    expect(accountHasLapsed(unverified, NOW)).toBe(true);
    expect(accountHasLapsed(inSetup(new Date(NOW.getTime() - 1)), NOW)).toBe(true);
    expect(accountHasLapsed(inSetup(null), NOW)).toBe(false);
    expect(accountHasLapsed({ ...inSetup(null), status: 'active' }, NOW)).toBe(false);
  });
});
