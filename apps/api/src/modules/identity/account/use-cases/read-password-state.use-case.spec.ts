import { FakeAccountStore } from '../testing/account-store.fake';
import { ReadPasswordState } from './read-password-state.use-case';

/**
 * S-28's password row (task 169). The rule that matters — a failed sign-in does not move the date — is SQL's, and
 * `test/change-password.e2e-spec.ts` holds it against the database; this holds the two arms the screen draws.
 */
describe('ReadPasswordState (task 169)', () => {
  const changedAt = new Date('2026-02-12T09:30:00Z');

  it('answers the date a held password last changed', async () => {
    const store = new FakeAccountStore();
    store.credentials.set('account-1', {
      accountId: 'account-1',
      passwordHash: 'hashed:x',
      failedAttempts: 0,
      lockedAt: null,
    });
    store.passwordChangedAt.set('account-1', changedAt);

    await expect(new ReadPasswordState(store).execute({ accountId: 'account-1' })).resolves.toEqual({
      set: true,
      changedAt,
    });
  });

  it('answers no password, and no date, for an account holding none (FR-2)', async () => {
    await expect(new ReadPasswordState(new FakeAccountStore()).execute({ accountId: 'account-1' })).resolves.toEqual({
      set: false,
      changedAt: null,
    });
  });
});
