import { hashPasswordResetToken } from '../domain/password-reset-token';
import {
  PasswordPolicyViolationError,
  ResetTokenInvalidError,
} from '../errors/account.errors';
import { ACCOUNT_STATUS } from '../models/account.model';
import { FakeAccountStore, FakePasswordHasher } from '../testing/account-store.fake';
import { ResetPassword } from './reset-password.use-case';

describe('ResetPassword (UC-09, FR-6)', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  const raw = 'reset-token-under-test';

  let store: FakeAccountStore;
  let hasher: FakePasswordHasher;
  let reset: ResetPassword;

  const seed = (options: { expired?: boolean; consumed?: boolean } = {}) => {
    store.accounts.push({
      id: 'account-1',
      email: 'ana.popescu@example.md',
      status: ACCOUNT_STATUS.ACTIVE,
      locale: 'ro',
      verifiedAt: new Date('2026-08-01T00:00:00Z'),
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
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

    it('an expired claim rolls back, so the row is not quietly consumed', async () => {
      seed({ expired: true });

      await expect(
        reset.execute({ token: raw, password: 'ParolaNoua1!' }),
      ).rejects.toBeInstanceOf(ResetTokenInvalidError);

      expect(store.resetTokens[0].consumedAt).toBeNull();
      expect(store.rollbacks).toBe(1);
    });
  });
});
