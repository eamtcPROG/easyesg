import { ACCOUNT_STATUS, type Account } from '@api/modules/identity/account/models/account.model';
import { AccountSetupNotPendingError, SetupNamesRequiredError } from '../errors/account-setup.errors';
import { FakeAccountSetupStore } from '../testing/account-setup-store.fake';
import { SaveSetupProfile, type SaveSetupProfileCommand } from './save-setup-profile.use-case';

describe('SaveSetupProfile (task 155; FR-9, FR-10, S-36)', () => {
  const now = new Date('2026-09-14T10:00:00Z');
  const registeredAt = new Date('2026-09-14T09:55:00Z');

  let store: FakeAccountSetupStore;

  const seedAccount = (overrides: Partial<Account> = {}): void => {
    store.accounts.push({
      id: 'account-1',
      email: 'ana.popescu@example.md',
      status: ACCOUNT_STATUS.AWAITING_SETUP,
      locale: 'ro',
      givenName: 'Ana Popescu',
      familyName: null,
      verifiedAt: registeredAt,
      setupExpiresAt: new Date('2026-09-21T09:55:00Z'),
      createdAt: registeredAt,
      updatedAt: registeredAt,
      ...overrides,
    });
  };

  const save = (overrides: Partial<SaveSetupProfileCommand> = {}) =>
    new SaveSetupProfile(store, () => now).execute({
      accountId: 'account-1',
      givenName: '  Ana ',
      familyName: ' Popescu ',
      locale: 'ru',
      ...overrides,
    });

  beforeEach(() => {
    store = new FakeAccountSetupStore();
  });

  it('saves both name parts trimmed and the language, and keeps setup while no password is held', async () => {
    seedAccount();

    const state = await save();

    expect(state.account).toMatchObject({
      givenName: 'Ana',
      familyName: 'Popescu',
      locale: 'ru',
      status: 'awaiting_setup',
    });
    expect(state.passwordSet).toBe(false);
  });

  it('activates an account that already holds a password, and clears its deadline', async () => {
    seedAccount();
    store.passwords.set('account-1', 'hashed:ParolaNoua1!');

    const state = await save();

    expect(state.account.status).toBe('active');
    expect(state.account.setupExpiresAt).toBeNull();
  });

  it('refuses a name part that is only whitespace, saving nothing', async () => {
    seedAccount();

    await expect(save({ familyName: '   ' })).rejects.toBeInstanceOf(SetupNamesRequiredError);
    expect(store.accounts[0].familyName).toBeNull();
    expect(store.accounts[0].locale).toBe('ro');
  });

  it('refuses an account that is not in setup — a profile change is not this call', async () => {
    seedAccount({ status: ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null });

    await expect(save()).rejects.toBeInstanceOf(AccountSetupNotPendingError);
    expect(store.accounts[0].givenName).toBe('Ana Popescu');
  });
});
