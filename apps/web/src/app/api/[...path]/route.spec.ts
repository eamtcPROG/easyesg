import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The token-attaching pass-through, against a stubbed fetch and cookie store (task 22).
 *
 * What is pinned here is the tier's SECURITY content — the pieces a browser e2e cannot see:
 * OQ-33's same-origin proof, the 401 for a session-less call, the bearer this tier attaches
 * and the browser never holds (AD-9), and rotation-before-forward with the successor sealed
 * back into the cookie. `server-only` and the request-scoped modules are mocked exactly as
 * `api-client.spec.ts` mocks them — they are the handler's dependencies, not the thing under
 * test.
 */
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getLocale: () => Promise.resolve('ro') }));

const cookieJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
      set: (name: string, value: string) => {
        cookieJar.set(name, value);
      },
      delete: (name: string) => {
        cookieJar.delete(name);
      },
    }),
}));

import { REFRESH_COOKIE } from '@/lib/session-cookie';
import { sealSession, unsealSession, type SessionPayload } from '@/server/session-codec';
import { GET, POST } from './route';

const SECRET = 'spec-secret-0000000000000000000000000000';
const fetchMock = vi.fn();

const sessionWith = (overrides: Partial<SessionPayload> = {}): SessionPayload => ({
  accessToken: 'live-access-token',
  accessTokenExpiresAt: Date.now() + 10 * 60 * 1000,
  refreshToken: 'refresh-token-1',
  refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  remembered: true,
  account: { id: 'a', email: 'ana@example.md', locale: 'ro' },
  ...overrides,
});

const request = (method: string, headers: Record<string, string> = {}) =>
  new NextRequest('http://web.test/api/v1/reports?page=1', { method, headers });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_BASE_URL', 'http://api.test/api/v1');
  vi.stubEnv('SESSION_SECRET', SECRET);
  cookieJar.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe('the /api/[...path] pass-through (task 22)', () => {
  it('answers 401 problem+json when no session cookie is presented, and never forwards', async () => {
    const response = await GET(request('GET'));

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toEqual({
      type: 'https://easyesg.md/problems/authentication-required',
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a cross-site write with 403 before reading any session (OQ-33)', async () => {
    cookieJar.set(REFRESH_COOKIE, sealSession(sessionWith(), SECRET));

    const response = await POST(request('POST', { 'sec-fetch-site': 'cross-site' }));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a same-site (sibling-subdomain) write — NFR-65 treats it as a separate zone', async () => {
    cookieJar.set(REFRESH_COOKIE, sealSession(sessionWith(), SECRET));

    const response = await POST(request('POST', { 'sec-fetch-site': 'same-site' }));

    expect(response.status).toBe(403);
  });

  it('falls back to the Origin/Host comparison where Sec-Fetch-Site is absent', async () => {
    cookieJar.set(REFRESH_COOKIE, sealSession(sessionWith(), SECRET));

    const refused = await POST(request('POST', { origin: 'http://evil.test' }));
    expect(refused.status).toBe(403);
  });

  it('forwards on the API origin with the bearer attached, and streams the answer back', async () => {
    cookieJar.set(REFRESH_COOKIE, sealSession(sessionWith(), SECRET));
    fetchMock.mockResolvedValue(
      new Response('{"htmlcode":200}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': 'corr-1',
          'x-internal-not-forwarded': 'nope',
        },
      }),
    );

    const response = await GET(request('GET', { 'accept-language': 'ru', traceparent: '00-x' }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/reports?page=1');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer live-access-token');
    expect(headers.get('accept-language')).toBe('ru');
    expect(headers.get('traceparent')).toBe('00-x');
    // The cookie must never reach the API; the session travels only as the bearer.
    expect(headers.get('cookie')).toBeNull();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-correlation-id')).toBe('corr-1');
    expect(response.headers.get('x-internal-not-forwarded')).toBeNull();
    expect(await response.text()).toBe('{"htmlcode":200}');
  });

  it('rotates an expiring access token first, reseals the cookie, and forwards the successor', async () => {
    cookieJar.set(
      REFRESH_COOKIE,
      sealSession(sessionWith({ accessTokenExpiresAt: Date.now() - 1000 }), SECRET),
    );
    const rotated = {
      accessToken: 'rotated-access-token',
      accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
      refreshToken: 'refresh-token-2',
      refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      remembered: true,
      account: { id: 'a', email: 'ana@example.md', locale: 'ro' },
    };
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ htmlcode: 200, object: rotated, messages: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await GET(request('GET'));

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(refreshUrl).toBe('http://api.test/api/v1/auth/session/refresh');
    expect(JSON.parse(refreshInit.body as string)).toEqual({ refreshToken: 'refresh-token-1' });

    const [, forwardInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(forwardInit.headers).get('authorization')).toBe(
      'Bearer rotated-access-token',
    );

    // The successor pair is sealed back into the cookie — the single-use predecessor is gone.
    const resealed = unsealSession(cookieJar.get(REFRESH_COOKIE) ?? '', SECRET);
    expect(resealed?.refreshToken).toBe('refresh-token-2');
    expect(response.status).toBe(204);
  });

  it("passes the API's own problem through when the refresh is refused, and drops the cookie", async () => {
    cookieJar.set(
      REFRESH_COOKIE,
      sealSession(sessionWith({ accessTokenExpiresAt: Date.now() - 1000 }), SECRET),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'https://easyesg.md/problems/session-expired',
          status: 401,
          title: 'Sesiune expirată',
        }),
        { status: 401, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    const response = await GET(request('GET'));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { type: string };
    expect(body.type).toBe('https://easyesg.md/problems/session-expired');
    expect(cookieJar.has(REFRESH_COOKIE)).toBe(false);
  });
});
