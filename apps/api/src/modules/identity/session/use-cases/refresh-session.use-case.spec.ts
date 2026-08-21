import {
  ACCOUNT_STATUS,
  type Account,
} from '@api/modules/identity/account/models/account.model';
import { REFRESH_REUSE_GRACE_MS, hashRefreshToken } from '../domain/refresh-token';
import {
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_IDLE_TTL_MS,
} from '../domain/session-expiry';
import { SessionExpiredError, SessionInvalidError } from '../errors/session.errors';
import { SESSION_REVOKED_REASON } from '../models/session.model';
import { FakeAccessTokenSigner, FakeSessionStore } from '../testing/session-store.fake';
import { RefreshSession } from './refresh-session.use-case';

describe('RefreshSession (AD-12)', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  const raw = 'refresh-token-under-test';

  let store: FakeSessionStore;
  let signer: FakeAccessTokenSigner;
  let refresh: RefreshSession;

  const account: Account = {
    id: 'account-1',
    email: 'ana.popescu@example.md',
    status: ACCOUNT_STATUS.ACTIVE,
    locale: 'ro',
    verifiedAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  /** A session holding `raw` as its live token, aged as the spec needs. */
  const seedSession = (options: {
    sessionAgeMs?: number;
    tokenAgeMs?: number;
    consumedAgoMs?: number;
    revoked?: boolean;
  } = {}) => {
    const createdAt = new Date(now.getTime() - (options.sessionAgeMs ?? 0));
    const issuedAt = new Date(now.getTime() - (options.tokenAgeMs ?? 0));
    store.sessions.push({
      id: 'session-1',
      accountId: account.id,
      createdAt,
      revokedAt: options.revoked ? new Date(now.getTime() - 1000) : null,
      revokedReason: options.revoked ? SESSION_REVOKED_REASON.SIGNED_OUT : null,
    });
    store.refreshTokens.push({
      id: 'token-1',
      sessionId: 'session-1',
      tokenHash: hashRefreshToken(raw),
      issuedAt,
      consumedAt:
        options.consumedAgoMs === undefined
          ? null
          : new Date(now.getTime() - options.consumedAgoMs),
    });
  };

  beforeEach(() => {
    store = new FakeSessionStore();
    store.seedAccount(account);
    signer = new FakeAccessTokenSigner();
    refresh = new RefreshSession(store, signer, () => now);
  });

  it('rotates: consumes the presented token, issues a successor, same session', async () => {
    seedSession();

    const issued = await refresh.execute({ refreshToken: raw });

    expect(issued.sessionId).toBe('session-1');
    expect(issued.refreshToken).not.toBe(raw);
    const live = store.liveTokensFor('session-1');
    expect(live).toHaveLength(1);
    expect(live[0].tokenHash.equals(hashRefreshToken(issued.refreshToken))).toBe(true);
    expect(store.refreshTokens[0].consumedAt).toEqual(now);
  });

  it('reports the idle bound rolled from this rotation — until the absolute cap is nearer', async () => {
    seedSession({ sessionAgeMs: SESSION_ABSOLUTE_TTL_MS - 60_000, tokenAgeMs: 24 * 60 * 60 * 1000 });

    const issued = await refresh.execute({ refreshToken: raw });

    // 30 days minus a minute into the session, the absolute cap is what remains — not 7 days.
    expect(issued.refreshTokenExpiresAt.getTime()).toBe(now.getTime() + 60_000);
  });

  it('refuses a token that was never issued', async () => {
    await expect(refresh.execute({ refreshToken: 'never-issued' })).rejects.toBeInstanceOf(
      SessionInvalidError,
    );
  });

  it('refuses anything presented against a revoked session', async () => {
    seedSession({ revoked: true });

    await expect(refresh.execute({ refreshToken: raw })).rejects.toBeInstanceOf(
      SessionInvalidError,
    );
  });

  describe('reuse detection', () => {
    it('revokes the whole session when a rotated-away token resurfaces past the grace', async () => {
      seedSession({ consumedAgoMs: REFRESH_REUSE_GRACE_MS + 1000 });

      await expect(refresh.execute({ refreshToken: raw })).rejects.toBeInstanceOf(
        SessionInvalidError,
      );

      // The refusal is uniform; the revocation is the silent alarm — and it COMMITTED.
      expect(store.sessions[0].revokedReason).toBe(SESSION_REVOKED_REASON.REFRESH_REUSED);
      expect(store.rollbacks).toBe(0);
    });

    it('reads a token consumed within the grace as a race, not a theft', async () => {
      seedSession({ consumedAgoMs: 1000 });

      await expect(refresh.execute({ refreshToken: raw })).rejects.toBeInstanceOf(
        SessionInvalidError,
      );
      expect(store.sessions[0].revokedAt).toBeNull();
    });
  });

  describe('expiry honoured (§12.5.6, OQ-35)', () => {
    it('a token idle past 7 days answers session-expired', async () => {
      seedSession({ sessionAgeMs: SESSION_IDLE_TTL_MS + 1000, tokenAgeMs: SESSION_IDLE_TTL_MS + 1000 });

      await expect(refresh.execute({ refreshToken: raw })).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
      // Left unconsumed: the row still says what state the session died in.
      expect(store.refreshTokens[0].consumedAt).toBeNull();
    });

    it('rotation cannot outlive the 30-day absolute cap', async () => {
      seedSession({ sessionAgeMs: SESSION_ABSOLUTE_TTL_MS, tokenAgeMs: 60_000 });

      await expect(refresh.execute({ refreshToken: raw })).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
    });
  });
});
