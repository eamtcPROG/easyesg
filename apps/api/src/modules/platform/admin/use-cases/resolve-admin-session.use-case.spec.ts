import { hashRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import type { AdminCookiePayload } from '../domain/admin-cookie-codec';
import {
  AdminSessionExpiredError,
  AdminSessionInvalidError,
} from '../errors/admin-session.errors';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import {
  ADMIN_ROLE,
  ADMIN_SESSION_REVOKED_REASON,
  type AdminRole,
} from '../models/admin-session.model';
import { FakeAdminSessionStore } from '../testing/admin-session-store.fake';
import {
  RESOLVED_ADMIN_SESSION,
  ResolveAdminSession,
} from './resolve-admin-session.use-case';

const NOW = new Date('2026-08-21T12:00:00Z');

/** Tokens whose validity is IN the value, so specs choose the branch by construction. */
const fakeTokens: AdminTokens = {
  sign: (sessionId) => Promise.resolve(`live:${sessionId}`),
  verify: (token) =>
    Promise.resolve(token.startsWith('live:') ? token.slice('live:'.length) : null),
  cookieKey: () => Buffer.alloc(32),
};

const identity = {
  id: '00000000-0000-7000-8000-00000000aaaa',
  email: 'operator@easyesg.md',
  role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
} as const;

const payload = (overrides: Partial<AdminCookiePayload> = {}): AdminCookiePayload => ({
  accessToken: 'live:session-1',
  accessTokenExpiresAt: NOW.getTime() + 10 * 60 * 1000,
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: NOW.getTime() + 8 * 60 * 60 * 1000,
  identity,
  ...overrides,
});

function storeWithSession(options: {
  createdAt?: Date;
  issuedAt?: Date;
  consumedAt?: Date | null;
  revoked?: boolean;
  accountActive?: boolean;
  role?: AdminRole;
}): FakeAdminSessionStore {
  const store = new FakeAdminSessionStore();
  store.accounts.push({
    ...identity,
    role: options.role ?? identity.role,
    active: options.accountActive ?? true,
    passwordHash: 'hashed:x',
    totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    failedAttempts: 0,
    lockedAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  });
  store.sessions.push({
    id: 'session-1',
    accountId: identity.id,
    createdAt: options.createdAt ?? new Date(NOW.getTime() - 60 * 60 * 1000),
    revokedAt: options.revoked ? new Date(NOW.getTime() - 1000) : null,
    revokedReason: options.revoked ? ADMIN_SESSION_REVOKED_REASON.SIGNED_OUT : null,
  });
  store.refreshTokens.push({
    id: 'token-1',
    sessionId: 'session-1',
    tokenHash: hashRefreshToken('refresh-1'),
    issuedAt: options.issuedAt ?? new Date(NOW.getTime() - 60 * 60 * 1000),
    consumedAt: options.consumedAt ?? null,
  });
  return store;
}

const resolve = (store: FakeAdminSessionStore) =>
  new ResolveAdminSession(store, fakeTokens, () => NOW);

describe('ResolveAdminSession (task 23)', () => {
  it('answers current for a live token over a live session, with the identity the store holds now', async () => {
    // Sealed at sign-in as a Platform Administrator; the account holds Billing Operator today. What
    // the request is judged against is the record, not the cookie (AD-12, task 145) — this case
    // answered from the cookie until then, and passed against an empty store.
    const store = storeWithSession({ role: ADMIN_ROLE.BILLING_OPERATOR });
    const resolved = await resolve(store).execute({ payload: payload() });

    expect(resolved).toEqual({
      kind: RESOLVED_ADMIN_SESSION.CURRENT,
      identity: { ...identity, role: ADMIN_ROLE.BILLING_OPERATOR },
      sessionId: 'session-1',
    });
    // Judged, not exchanged: a live access token rotates nothing.
    expect(store.refreshTokens).toHaveLength(1);
    expect(store.refreshTokens[0].consumedAt).toBeNull();
  });

  /**
   * Task 145 — a revoked session stops being honoured inside the request. Every case presents an
   * access token that still VERIFIES, which is exactly the state in which the resolver answered from
   * the sealed cookie alone and honoured a revoked session for up to fifteen minutes. Written before
   * the fix, and each seen to fail against it.
   */
  describe('a live access token is judged against its session (task 145)', () => {
    it('refuses a revoked session on its next request', async () => {
      const store = storeWithSession({ revoked: true });

      await expect(resolve(store).execute({ payload: payload() })).rejects.toBeInstanceOf(
        AdminSessionInvalidError,
      );
    });

    it('refuses a token naming a session that does not exist', async () => {
      await expect(
        resolve(new FakeAdminSessionStore()).execute({ payload: payload() }),
      ).rejects.toBeInstanceOf(AdminSessionInvalidError);
    });

    it('refuses a deactivated account on its next request (AD-12)', async () => {
      const store = storeWithSession({ accountActive: false });

      await expect(resolve(store).execute({ payload: payload() })).rejects.toBeInstanceOf(
        AdminSessionInvalidError,
      );
    });

    it('keeps a session current nine hours after sign-in when its live token was issued two minutes ago', async () => {
      // Idle counts from the LIVE refresh token and absolute from sign-in (§12.5.6). Swapping the two
      // anchors, anchoring idle at sign-in, or picking the consumed token would each end this session
      // at eight hours — which is why the consumed sign-in token sits first in the list.
      const store = storeWithSession({
        createdAt: new Date(NOW.getTime() - 9 * 60 * 60 * 1000),
        issuedAt: new Date(NOW.getTime() - 2 * 60 * 1000),
      });
      store.refreshTokens.unshift({
        id: 'token-0',
        sessionId: 'session-1',
        tokenHash: hashRefreshToken('refresh-0'),
        issuedAt: new Date(NOW.getTime() - 9 * 60 * 60 * 1000),
        consumedAt: new Date(NOW.getTime() - 2 * 60 * 1000),
      });

      const resolved = await resolve(store).execute({ payload: payload() });

      expect(resolved.kind).toBe(RESOLVED_ADMIN_SESSION.CURRENT);
    });

    it('answers a revoked session past its lifetime as invalid — revoked is judged first, as rotation judges it', async () => {
      const store = storeWithSession({
        revoked: true,
        createdAt: new Date(NOW.getTime() - (12 * 60 + 1) * 60 * 1000),
        issuedAt: new Date(NOW.getTime() - 2 * 60 * 1000),
      });

      await expect(resolve(store).execute({ payload: payload() })).rejects.toBeInstanceOf(
        AdminSessionInvalidError,
      );
    });

    it('answers a deactivated account past its lifetime as expired, in this tier and in rotation alike', async () => {
      // One state, one answer in both tiers: the lifetimes are judged before the account in each.
      const dead = () =>
        storeWithSession({
          accountActive: false,
          createdAt: new Date(NOW.getTime() - (12 * 60 + 1) * 60 * 1000),
          issuedAt: new Date(NOW.getTime() - 2 * 60 * 1000),
        });

      await expect(resolve(dead()).execute({ payload: payload() })).rejects.toBeInstanceOf(
        AdminSessionExpiredError,
      );
      await expect(
        resolve(dead()).execute({ payload: payload({ accessToken: 'dead' }) }),
      ).rejects.toBeInstanceOf(AdminSessionExpiredError);
    });

    it('answers expired past the absolute bound, inside the access token’s fifteen minutes', async () => {
      // Rotated two minutes ago, so the token is live — and signed in twelve hours and a minute
      // ago, so the session is over. The lifetimes are judged at the point of use (§12.5.6).
      const store = storeWithSession({
        createdAt: new Date(NOW.getTime() - (12 * 60 + 1) * 60 * 1000),
        issuedAt: new Date(NOW.getTime() - 2 * 60 * 1000),
      });

      await expect(resolve(store).execute({ payload: payload() })).rejects.toBeInstanceOf(
        AdminSessionExpiredError,
      );
    });
  });

  it('rotates on an expired access token: consumes, issues the successor, re-reads the account', async () => {
    const store = storeWithSession({});
    const resolved = await resolve(store).execute({
      payload: payload({ accessToken: 'dead' }),
    });

    if (resolved.kind !== RESOLVED_ADMIN_SESSION.ROTATED) throw new Error('expected rotation');
    expect(resolved.issued.identity).toEqual(identity);
    expect(resolved.issued.accessToken).toBe('live:session-1');
    expect(resolved.issued.refreshToken).not.toBe('refresh-1');
    expect(store.refreshTokens).toHaveLength(2);
    expect(store.refreshTokens[0].consumedAt).toEqual(NOW);
    // Idle rolls from this rotation; absolute still counts from sign-in (§12.5.6).
    expect(resolved.issued.refreshTokenExpiresAt.getTime()).toBe(
      NOW.getTime() + 8 * 60 * 60 * 1000,
    );
  });

  it('refuses a consumed token inside the race grace without revoking, and revokes past it', async () => {
    const inGrace = storeWithSession({ consumedAt: new Date(NOW.getTime() - 10 * 1000) });
    await expect(
      resolve(inGrace).execute({ payload: payload({ accessToken: 'dead' }) }),
    ).rejects.toBeInstanceOf(AdminSessionInvalidError);
    expect(inGrace.sessions[0].revokedAt).toBeNull();

    const pastGrace = storeWithSession({ consumedAt: new Date(NOW.getTime() - 60 * 1000) });
    await expect(
      resolve(pastGrace).execute({ payload: payload({ accessToken: 'dead' }) }),
    ).rejects.toBeInstanceOf(AdminSessionInvalidError);
    expect(pastGrace.sessions[0].revokedReason).toBe(ADMIN_SESSION_REVOKED_REASON.REFRESH_REUSED);
  });

  it('answers expired past the idle bound — the console signs in again, nothing rotates', async () => {
    const store = storeWithSession({
      issuedAt: new Date(NOW.getTime() - 9 * 60 * 60 * 1000),
    });
    await expect(
      resolve(store).execute({ payload: payload({ accessToken: 'dead' }) }),
    ).rejects.toBeInstanceOf(AdminSessionExpiredError);
    expect(store.refreshTokens[0].consumedAt).toBeNull();
  });

  it('answers expired past the absolute bound even under recent rotation', async () => {
    const store = storeWithSession({
      createdAt: new Date(NOW.getTime() - 13 * 60 * 60 * 1000),
      issuedAt: new Date(NOW.getTime() - 60 * 1000),
    });
    await expect(
      resolve(store).execute({ payload: payload({ accessToken: 'dead' }) }),
    ).rejects.toBeInstanceOf(AdminSessionExpiredError);
  });

  it('refuses rotation for a revoked session and for a deactivated account', async () => {
    const revoked = storeWithSession({ revoked: true });
    await expect(
      resolve(revoked).execute({ payload: payload({ accessToken: 'dead' }) }),
    ).rejects.toBeInstanceOf(AdminSessionInvalidError);

    const deactivated = storeWithSession({ accountActive: false });
    await expect(
      resolve(deactivated).execute({ payload: payload({ accessToken: 'dead' }) }),
    ).rejects.toBeInstanceOf(AdminSessionInvalidError);
  });
});
