import { hashPasswordResetToken } from '../domain/password-reset-token';
import {
  PasswordPolicyViolationError,
  ResetTokenInvalidError,
} from '../errors/account.errors';
import {
  ACCOUNT_STATUS,
  type Account,
  type PasswordResetTokenPurpose,
} from '../models/account.model';
import { FakeAccountStore, FakePasswordHasher } from '../testing/account-store.fake';
import { ResetPassword } from './reset-password.use-case';

describe('ResetPassword (UC-09, FR-6)', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  const raw = 'reset-token-under-test';

  let store: FakeAccountStore;
  let hasher: FakePasswordHasher;
  let reset: ResetPassword;

  const seed = (
    options: {
      expired?: boolean;
      consumed?: boolean;
      account?: Partial<Account>;
      purpose?: PasswordResetTokenPurpose;
    } = {},
  ) => {
    store.accounts.push({
      id: 'account-1',
      email: 'ana.popescu@example.md',
      status: ACCOUNT_STATUS.ACTIVE,
      locale: 'ro',
      givenName: null,
      familyName: null,
      verifiedAt: new Date('2026-08-01T00:00:00Z'),
      setupExpiresAt: null,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      ...options.account,
    });
    // A locked credential, deliberately: §12.5.6 names the consumed link as the lockout release,
    // so the seeded state is the one the flow exists to rescue.
    store.credentials.set('account-1', {
      accountId: 'account-1',
      passwordHash: 'hashed:VecheaParola1!',
      failedAttempts: 10,
      lockedAt: new Date(now.getTime() - 60_000),
    });
    store.resetTokens.push({
      accountId: 'account-1',
      tokenHash: hashPasswordResetToken(raw),
      expiresAt: options.expired
        ? new Date(now.getTime() - 1000)
        : new Date(now.getTime() + 30 * 60 * 1000),
      consumedAt: options.consumed ? new Date(now.getTime() - 1000) : null,
      purpose: options.purpose ?? 'reset',
    });
    store.sessions.push(
      { id: 'session-1', accountId: 'account-1', revokedAt: null, revokedReason: null },
      { id: 'session-2', accountId: 'account-1', revokedAt: null, revokedReason: null },
    );
  };

  beforeEach(() => {
    store = new FakeAccountStore();
    hasher = new FakePasswordHasher();
    reset = new ResetPassword(store, hasher, () => now);
  });

  it('replaces the credential, releases the lockout, and revokes every session — atomically', async () => {
    seed();

    await reset.execute({ token: raw, password: 'ParolaNoua1!' });

    const credential = store.credentials.get('account-1');
    expect(credential?.passwordHash).toBe('hashed:ParolaNoua1!');
    expect(credential?.failedAttempts).toBe(0);
    expect(credential?.lockedAt).toBeNull();

    expect(store.resetTokens[0].consumedAt).toEqual(now);
    expect(store.sessions.every((s) => s.revokedAt !== null)).toBe(true);
    expect(store.sessions.every((s) => s.revokedReason === 'password_reset')).toBe(true);
  });

  it('gives a social-only account its first password — UC-09’s alternate flow (task 67.11)', async () => {
    seed();
    store.credentials.delete('account-1');

    await reset.execute({ token: raw, password: 'ParolaNoua1!' });

    expect(store.credentials.get('account-1')).toEqual({
      accountId: 'account-1',
      passwordHash: 'hashed:ParolaNoua1!',
      failedAttempts: 0,
      lockedAt: null,
    });
    expect(store.resetTokens[0].consumedAt).toEqual(now);
    expect(store.sessions.every((s) => s.revokedReason === 'password_reset')).toBe(true);
  });

  describe('an account in setup (task 155)', () => {
    it('keeps its setup while the name is owed — a reset sets the password half', async () => {
      seed({ account: { status: ACCOUNT_STATUS.AWAITING_SETUP, givenName: 'Ana Popescu' } });
      store.credentials.delete('account-1');

      await reset.execute({ token: raw, password: 'ParolaNoua1!' });

      expect(store.credentials.get('account-1')?.passwordHash).toBe('hashed:ParolaNoua1!');
      expect(store.accounts[0].status).toBe('awaiting_setup');
    });

    it('becomes active when both name parts are already held, and loses its deadline', async () => {
      seed({
        account: {
          status: ACCOUNT_STATUS.AWAITING_SETUP,
          setupExpiresAt: new Date(now.getTime() + 60_000),
          givenName: 'Ana',
          familyName: 'Popescu',
        },
      });
      store.credentials.delete('account-1');

      await reset.execute({ token: raw, password: 'ParolaNoua1!' });

      expect(store.accounts[0].status).toBe('active');
      expect(store.accounts[0].setupExpiresAt).toBeNull();
    });

    it('refuses a link whose account passed its setup deadline, changing nothing', async () => {
      seed({
        account: { status: ACCOUNT_STATUS.AWAITING_SETUP, setupExpiresAt: new Date(now.getTime() - 1) },
      });

      await expect(reset.execute({ token: raw, password: 'ParolaNoua1!' })).rejects.toBeInstanceOf(
        ResetTokenInvalidError,
      );
      expect(store.credentials.get('account-1')?.passwordHash).toBe('hashed:VecheaParola1!');
      expect(store.resetTokens[0].consumedAt).toBeNull();
    });
  });

  it('refuses a value naming no live link without hashing the password (task 155)', async () => {
    seed();

    await expect(
      reset.execute({ token: 'wrong-token', password: 'ParolaNoua1!' }),
    ).rejects.toBeInstanceOf(ResetTokenInvalidError);
    expect(hasher.hashed).toHaveLength(0);
  });

  it('refuses a setup grant, which only the setup route claims, and leaves it unspent (task 155)', async () => {
    seed({ purpose: 'account_setup' });

    await expect(reset.execute({ token: raw, password: 'ParolaNoua1!' })).rejects.toBeInstanceOf(
      ResetTokenInvalidError,
    );
    expect(store.resetTokens[0].consumedAt).toBeNull();
    expect(store.credentials.get('account-1')?.passwordHash).toBe('hashed:VecheaParola1!');
    expect(hasher.hashed).toHaveLength(0);
  });

  it('refuses a policy-violating password before touching the link, so the link survives', async () => {
    seed();

    await expect(reset.execute({ token: raw, password: 'scurta' })).rejects.toBeInstanceOf(
      PasswordPolicyViolationError,
    );

    expect(store.resetTokens[0].consumedAt).toBeNull();
    expect(store.credentials.get('account-1')?.passwordHash).toBe('hashed:VecheaParola1!');
  });

  describe('the collapsed refusal', () => {
    it.each([
      ['never issued', () => seed({ consumed: false }), 'wrong-token'],
      ['already consumed', () => seed({ consumed: true }), raw],
      ['expired', () => seed({ expired: true }), raw],
    ])('%s → one indistinguishable error, and nothing changes', async (_label, arrange, token) => {
      arrange();

      await expect(
        reset.execute({ token, password: 'ParolaNoua1!' }),
      ).rejects.toBeInstanceOf(ResetTokenInvalidError);

      expect(store.credentials.get('account-1')?.passwordHash).toBe('hashed:VecheaParola1!');
      expect(store.credentials.get('account-1')?.lockedAt).not.toBeNull();
      expect(store.sessions.every((s) => s.revokedAt === null)).toBe(true);
    });

    /**
     * Since task 155 an expired link is refused by the look-up before any claim, so the rollback is
     * reached only by a link that runs out between the two — which is the case the claim's own expiry
     * comparison still exists for.
     */
    it('a link that runs out between the look-up and the claim rolls back, so the row is not quietly consumed', async () => {
      seed();
      const runsOut = store.resetTokens[0].expiresAt;
      const instants = [now, runsOut];
      const racing = new ResetPassword(store, hasher, () => instants.shift() ?? runsOut);

      await expect(
        racing.execute({ token: raw, password: 'ParolaNoua1!' }),
      ).rejects.toBeInstanceOf(ResetTokenInvalidError);

      expect(store.resetTokens[0].consumedAt).toBeNull();
      expect(store.rollbacks).toBe(1);
    });
  });
});
