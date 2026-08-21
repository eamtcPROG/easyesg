import { hashRefreshToken } from '../domain/refresh-token';
import { SESSION_REVOKED_REASON } from '../models/session.model';
import { FakeSessionStore } from '../testing/session-store.fake';
import { SignOut } from './sign-out.use-case';

describe('SignOut (UC-06, FR-5)', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  const raw = 'refresh-token-under-test';

  let store: FakeSessionStore;
  let signOut: SignOut;

  const seedSession = (options: { consumed?: boolean; revoked?: boolean } = {}) => {
    store.sessions.push({
      id: 'session-1',
      accountId: 'account-1',
      createdAt: new Date(now.getTime() - 1000),
      revokedAt: options.revoked ? new Date(now.getTime() - 500) : null,
      revokedReason: options.revoked ? SESSION_REVOKED_REASON.PASSWORD_RESET : null,
    });
    store.refreshTokens.push({
      id: 'token-1',
      sessionId: 'session-1',
      tokenHash: hashRefreshToken(raw),
      issuedAt: new Date(now.getTime() - 1000),
      consumedAt: options.consumed ? new Date(now.getTime() - 500) : null,
    });
  };

  beforeEach(() => {
    store = new FakeSessionStore();
    signOut = new SignOut(store, () => now);
  });

  it('terminates the session server-side', async () => {
    seedSession();

    await signOut.execute({ refreshToken: raw });

    expect(store.sessions[0].revokedAt).toEqual(now);
    expect(store.sessions[0].revokedReason).toBe(SESSION_REVOKED_REASON.SIGNED_OUT);
  });

  it('a rotated-away token still ends its session — logging out is not refusable', async () => {
    seedSession({ consumed: true });

    await signOut.execute({ refreshToken: raw });

    expect(store.sessions[0].revokedReason).toBe(SESSION_REVOKED_REASON.SIGNED_OUT);
  });

  it('is idempotent, and never rewrites why a session first died', async () => {
    seedSession({ revoked: true });

    await signOut.execute({ refreshToken: raw });

    expect(store.sessions[0].revokedReason).toBe(SESSION_REVOKED_REASON.PASSWORD_RESET);
  });

  it('answers nothing for a token that was never issued', async () => {
    await expect(signOut.execute({ refreshToken: 'never-issued' })).resolves.toBeUndefined();
  });
});
