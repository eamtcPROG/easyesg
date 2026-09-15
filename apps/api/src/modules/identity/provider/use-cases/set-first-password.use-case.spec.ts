import { ACCOUNT_SETUP_PROOF_WINDOW_MS } from '@api/modules/identity/account/domain/account-setup';
import { PasswordPolicyViolationError } from '@api/modules/identity/account/errors/account.errors';
import { ACCOUNT_STATUS, type Account } from '@api/modules/identity/account/models/account.model';
import { FakePasswordHasher } from '@api/modules/identity/account/testing/account-store.fake';
import {
  AccountSetupNotPendingError,
  FirstPasswordAlreadySetError,
  SetupSessionStaleError,
} from '../errors/account-setup.errors';
import { FakeAccountSetupStore } from '../testing/account-setup-store.fake';
import { SetFirstPassword } from './set-first-password.use-case';

describe('SetFirstPassword (task 155; FR-2, S-36)', () => {
  const now = new Date('2026-09-14T10:00:00Z');
  const registeredAt = new Date('2026-09-14T09:55:00Z');
  const PASSWORD = 'ParolaNoua1!';

  let store: FakeAccountSetupStore;
  let hasher: FakePasswordHasher;

  const seedAccount = (overrides: Partial<Account> = {}): void => {
    store.accounts.push({
      id: 'account-1',
      email: 'ana.popescu@example.md',
      status: ACCOUNT_STATUS.AWAITING_SETUP,
      locale: 'ro',
      // What a provider seeds: its single display name, in the given-name column alone.
      givenName: 'Ana Popescu',
      familyName: null,
      verifiedAt: registeredAt,
      setupExpiresAt: new Date('2026-09-21T09:55:00Z'),
      createdAt: registeredAt,
      updatedAt: registeredAt,
      ...overrides,
    });
  };

  const signedInAgo = (ms: number): void => {
    store.sessionCreatedAt.set('session-1', new Date(now.getTime() - ms));
  };

  const setFirstPassword = (password = PASSWORD) =>
    new SetFirstPassword(store, hasher, () => now).execute({
      accountId: 'account-1',
      sessionId: 'session-1',
      password,
    });

  beforeEach(() => {
    store = new FakeAccountSetupStore();
    hasher = new FakePasswordHasher();
  });

  it('sets the first password on a provider sign-in inside the window, and keeps setup while the name is owed', async () => {
    seedAccount();
    signedInAgo(60_000);

    const state = await setFirstPassword();

    expect(state.passwordSet).toBe(true);
    expect(state.account.status).toBe('awaiting_setup');
    expect(store.passwords.get('account-1')).toBe(`hashed:${PASSWORD}`);
  });

  it('activates an account that already holds both name parts, and clears its deadline', async () => {
    seedAccount({ givenName: 'Ana', familyName: 'Popescu' });
    signedInAgo(60_000);

    const state = await setFirstPassword();

    expect(state.account.status).toBe('active');
    expect(state.account.setupExpiresAt).toBeNull();
  });

  it('refuses a sign-in exactly fifteen minutes old, writing nothing', async () => {
    seedAccount();
    signedInAgo(ACCOUNT_SETUP_PROOF_WINDOW_MS);

    await expect(setFirstPassword()).rejects.toBeInstanceOf(SetupSessionStaleError);
    expect(store.passwords.size).toBe(0);
  });

  it('refuses a session it cannot find as a stale proof', async () => {
    seedAccount();

    await expect(setFirstPassword()).rejects.toBeInstanceOf(SetupSessionStaleError);
  });

  it('refuses an account that already holds a password, and leaves that password alone', async () => {
    seedAccount();
    signedInAgo(60_000);
    store.passwords.set('account-1', 'hashed:VecheaParola1!');

    await expect(setFirstPassword()).rejects.toBeInstanceOf(FirstPasswordAlreadySetError);
    expect(store.passwords.get('account-1')).toBe('hashed:VecheaParola1!');
  });

  it('refuses an account that is not in setup', async () => {
    seedAccount({ status: ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null });
    signedInAgo(60_000);

    await expect(setFirstPassword()).rejects.toBeInstanceOf(AccountSetupNotPendingError);
  });

  it('refuses a password outside the policy before hashing it', async () => {
    seedAccount();
    signedInAgo(60_000);

    await expect(setFirstPassword('scurta')).rejects.toBeInstanceOf(PasswordPolicyViolationError);
    expect(hasher.hashed).toEqual([]);
  });
});
