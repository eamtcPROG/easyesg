import { hashRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import type { AdminCookiePayload } from '../domain/admin-cookie-codec';
import {
  AdminSessionExpiredError,
  AdminSessionInvalidError,
} from '../errors/admin-session.errors';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import { ADMIN_ROLE, ADMIN_SESSION_REVOKED_REASON } from '../models/admin-session.model';
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
}): FakeAdminSessionStore {
  const store = new FakeAdminSessionStore();
  store.accounts.push({
    ...identity,
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
  it('answers from the sealed payload while the access token verifies — no store access', async () => {
    const store = new FakeAdminSessionStore(); // empty on purpose: a lookup would return nothing
    const resolved = await resolve(store).execute({ payload: payload() });

    expect(resolved).toEqual({
      kind: RESOLVED_ADMIN_SESSION.CURRENT,
      identity,
      sessionId: 'session-1',
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
