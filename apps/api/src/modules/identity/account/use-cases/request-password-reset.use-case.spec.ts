import { PASSWORD_RESET_REQUESTED } from '../constants/account.constants';
import { hashPasswordResetToken, PASSWORD_RESET_TOKEN_TTL_MS } from '../domain/password-reset-token';
import { AuthRateLimitedError } from '../errors/account.errors';
import { ACCOUNT_STATUS, type Account } from '../models/account.model';
import { FakeAccountStore } from '../testing/account-store.fake';
import { RequestPasswordReset } from './request-password-reset.use-case';

describe('RequestPasswordReset (UC-08, FR-6)', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  const email = 'ana.popescu@example.md';

  let store: FakeAccountStore;
  let request: RequestPasswordReset;

  const seedAccount = (overrides: Partial<Account> = {}): void => {
    store.accounts.push({
      id: 'account-1',
      email,
      status: ACCOUNT_STATUS.ACTIVE,
      locale: 'ro',
      verifiedAt: new Date('2026-08-01T00:00:00Z'),
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      ...overrides,
    });
  };

  beforeEach(() => {
    store = new FakeAccountStore();
    request = new RequestPasswordReset(store, () => now);
  });

  it('issues a 60-minute challenge and commits the email intent with it (P-8, OQ-54)', async () => {
    seedAccount();

    await request.execute({ email });

    expect(store.resetTokens).toHaveLength(1);
    expect(store.resetTokens[0].expiresAt).toEqual(
      new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
    );

    expect(store.effects).toHaveLength(1);
    const effect = store.effects[0];
    expect(effect.eventType).toBe(PASSWORD_RESET_REQUESTED);
    // The payload carries the raw value; the table holds exactly its hash and never the value.
    const token = effect.payload.token as string;
    expect(store.resetTokens[0].tokenHash.equals(hashPasswordResetToken(token))).toBe(true);
  });

  it('a reissue retires the previous challenge — one live link per account', async () => {
    seedAccount();

    await request.execute({ email });
    await request.execute({ email });

    expect(store.resetTokens).toHaveLength(2);
    expect(store.resetTokens.filter((t) => t.consumedAt === null)).toHaveLength(1);
  });

  describe('the uniform nothing (NFR-64)', () => {
    it('an unknown address resolves identically and issues nothing', async () => {
      await expect(request.execute({ email: 'nobody@example.md' })).resolves.toBeUndefined();

      expect(store.resetTokens).toHaveLength(0);
      expect(store.effects).toHaveLength(0);
    });

    it('an unverified account gets no reset link — verification is the only activation path', async () => {
      seedAccount({ status: ACCOUNT_STATUS.UNVERIFIED, verifiedAt: null, createdAt: now });

      await expect(request.execute({ email })).resolves.toBeUndefined();

      expect(store.resetTokens).toHaveLength(0);
      expect(store.effects).toHaveLength(0);
    });
  });

  it('refuses the sixth request in the window without recording the refusal (§12.5.6)', async () => {
    seedAccount();
    for (let i = 0; i < 5; i += 1) await request.execute({ email });
    expect(store.attempts).toHaveLength(5);

    await expect(request.execute({ email })).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.attempts).toHaveLength(5);
    expect(store.resetTokens.filter((t) => t.consumedAt === null)).toHaveLength(1);
  });
});
