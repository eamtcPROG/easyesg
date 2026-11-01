import { hashPasswordResetToken } from '@api/modules/identity/account/domain/password-reset-token';
import {
  ACCOUNT_STATUS,
  PASSWORD_RESET_TOKEN_PURPOSE,
  type Account,
  type PasswordResetTokenPurpose,
} from '@api/modules/identity/account/models/account.model';
import { FakePasswordHasher } from '@api/modules/identity/account/testing/account-store.fake';
import { FakeAccessTokenSigner } from '@api/modules/identity/session/testing/session-store.fake';
import {
  AccountSetupNotPendingError,
  FirstPasswordAlreadySetError,
  SetupGrantInvalidError,
} from '../errors/account-setup.errors';
import { FakeAccountSetupStore } from '../testing/account-setup-store.fake';
import { SetFirstPasswordByGrant } from './set-first-password-by-grant.use-case';

describe('SetFirstPasswordByGrant (task 155; UC-03, FR-3, FR-6)', () => {
  const now = new Date('2026-09-14T10:00:00Z');
  const registeredAt = new Date('2026-09-12T10:00:00Z');
  const GRANT = 'grant-under-test';
  const PASSWORD = 'ParolaNoua1!';

  let store: FakeAccountSetupStore;
  let signer: FakeAccessTokenSigner;
  let hasher: FakePasswordHasher;

  const seed = (
    options: {
      account?: Partial<Account>;
      grantExpiresAt?: Date;
      purpose?: PasswordResetTokenPurpose;
    } = {},
  ): void => {
    store.accounts.push({
      id: 'account-1',
      email: 'ana.popescu@example.md',
      status: ACCOUNT_STATUS.AWAITING_SETUP,
      locale: 'ro',
      givenName: 'Ana Popescu',
      familyName: null,
      verifiedAt: new Date(now.getTime() - 60_000),
      setupExpiresAt: new Date('2026-09-19T10:00:00Z'),
      createdAt: registeredAt,
      updatedAt: registeredAt,
      ...options.account,
    });
    store.resetTokens.push({
      accountId: 'account-1',
      tokenHash: hashPasswordResetToken(GRANT),
      expiresAt: options.grantExpiresAt ?? new Date(now.getTime() + 10 * 60 * 1000),
      consumedAt: null,
      purpose: options.purpose ?? PASSWORD_RESET_TOKEN_PURPOSE.ACCOUNT_SETUP,
    });
  };

  const complete = (options: { remember?: boolean; clock?: () => Date } = {}) =>
    new SetFirstPasswordByGrant(store, hasher, signer, options.clock ?? (() => now)).execute({
      grant: GRANT,
      password: PASSWORD,
      remember: options.remember,
    });

  beforeEach(() => {
    store = new FakeAccountSetupStore();
    signer = new FakeAccessTokenSigner();
    hasher = new FakePasswordHasher();
  });

  it('sets the password, spends the grant and signs the person in on the lifetime they chose', async () => {
    seed();

    const issued = await complete({ remember: true });

    expect(store.passwords.get('account-1')).toBe(`hashed:${PASSWORD}`);
    expect(store.resetTokens[0].consumedAt).toEqual(now);
    expect(store.createdSessions).toEqual([
      expect.objectContaining({ accountId: 'account-1', remembered: true, at: now }),
    ]);
    expect(signer.signed[0].sessionId).toBe(issued.sessionId);
    // The name is still owed, so the session lands on S-36's second step.
    expect(issued.account.status).toBe('awaiting_setup');
  });

  it('issues the shorter lifetime when the step was not asked to keep the person signed in', async () => {
    seed();

    await complete();

    expect(store.createdSessions).toEqual([expect.objectContaining({ remembered: false })]);
  });

  it('ends every session the account already held before issuing its own (FR-6)', async () => {
    seed();

    await complete();

    expect(store.revokedSessions).toEqual([{ accountId: 'account-1', at: now }]);
  });

  it('activates an account whose name is already held', async () => {
    seed({ account: { givenName: 'Ana', familyName: 'Popescu' } });

    const issued = await complete();

    expect(issued.account.status).toBe('active');
  });

  it('refuses an emailed reset link, which never signs anyone in, without hashing the password', async () => {
    seed({ purpose: PASSWORD_RESET_TOKEN_PURPOSE.RESET });

    await expect(complete()).rejects.toBeInstanceOf(SetupGrantInvalidError);
    expect(hasher.hashed).toHaveLength(0);
    expect(store.resetTokens[0].consumedAt).toBeNull();
    expect(store.createdSessions).toHaveLength(0);
  });

  it('refuses a value that names no grant without hashing the password', async () => {
    await expect(complete()).rejects.toBeInstanceOf(SetupGrantInvalidError);
    expect(hasher.hashed).toHaveLength(0);
  });

  it('refuses the grant a second time', async () => {
    seed();
    await complete();

    await expect(complete()).rejects.toBeInstanceOf(SetupGrantInvalidError);
    expect(store.createdSessions).toHaveLength(1);
  });

  it('refuses a grant at the end of its quarter-hour before any work', async () => {
    seed({ grantExpiresAt: now });

    await expect(complete()).rejects.toBeInstanceOf(SetupGrantInvalidError);
    expect(hasher.hashed).toHaveLength(0);
    expect(store.resetTokens[0].consumedAt).toBeNull();
  });

  it('refuses a grant that runs out between the look-up and the claim, leaving it unspent by the rollback', async () => {
    const runsOut = new Date(now.getTime() + 1_000);
    seed({ grantExpiresAt: runsOut });
    const instants = [now, runsOut];

    await expect(complete({ clock: () => instants.shift() ?? runsOut })).rejects.toBeInstanceOf(
      SetupGrantInvalidError,
    );
    expect(store.resetTokens[0].consumedAt).toBeNull();
    expect(store.passwords.size).toBe(0);
  });

  it('refuses a grant whose account has passed its setup deadline', async () => {
    seed({ account: { setupExpiresAt: new Date(now.getTime() - 1) } });

    await expect(complete()).rejects.toBeInstanceOf(SetupGrantInvalidError);
    expect(store.createdSessions).toHaveLength(0);
  });

  /**
   * The web tier puts the grant back after these two refusals, on the strength of the rollback — so
   * the grant being unspent is the property, not only the error.
   */
  it('refuses a grant for an account no longer in setup, leaving the grant unspent', async () => {
    seed({ account: { status: ACCOUNT_STATUS.ACTIVE, setupExpiresAt: null } });

    await expect(complete()).rejects.toBeInstanceOf(AccountSetupNotPendingError);
    expect(store.resetTokens[0].consumedAt).toBeNull();
  });

  it('refuses a grant for an account that already holds a password, leaving the grant unspent', async () => {
    seed();
    store.passwords.set('account-1', 'hashed:earlier');

    await expect(complete()).rejects.toBeInstanceOf(FirstPasswordAlreadySetError);
    expect(store.resetTokens[0].consumedAt).toBeNull();
    expect(store.revokedSessions).toHaveLength(0);
  });
});
