// @vitest-environment node
//
// Node, not the suite's jsdom default: under jsdom Vite resolves with the `browser` condition, and
// `next/server` has no browser entry — next-intl's own `import 'next/server'` fails to resolve
// before a line of this file runs. The proxy is server code and never sees a DOM, so the right
// environment is the one that says so rather than an alias papering over the condition.
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The proxy's third job — page-load rotation (task 26.4, architecture.md §12.5.6).
 *
 * Two things here cannot be seen from a browser and are the reason this file exists.
 *
 * **The successor must be visible to the render of the SAME request.** A cookie set only on the
 * response reaches the browser and nothing else, so the Server Component would still read the
 * stale token and still be answered 401 — the defect would appear fixed while costing one error
 * screen per rotation, roughly once every fifteen minutes of use. The mechanism is
 * `NextRequest.cookies.set` mutating the `Cookie` header *before* next-intl clones
 * `request.headers` into `NextResponse.next({ request: { headers } })`, which makes the ordering
 * inside `proxy()` load-bearing rather than incidental. Nothing about that is visible in a
 * screenshot, and reordering it breaks nothing that any other test asserts.
 *
 * **next-intl is deliberately NOT mocked.** A stand-in that forwarded headers the way the real
 * middleware does would pin this file's ordering against a fiction, and go green on the day
 * next-intl stopped cloning. The composition is the thing under test, so the composition runs.
 */
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getLocale: () => Promise.resolve('ro') }));
vi.mock('next/headers', () => ({
  cookies: () => Promise.reject(new Error('the proxy has no request scope — that is the point')),
}));

import { REFRESH_COOKIE } from '@/lib/session-cookie';
import { sealSession, unsealSession, type SessionPayload } from '@/server/session-codec';
import proxy from './proxy';

const SECRET = 'spec-secret-0000000000000000000000000000';
const DAY_MS = 24 * 60 * 60 * 1000;

const fetchMock = vi.fn();

const sessionWith = (overrides: Partial<SessionPayload> = {}): SessionPayload => ({
  accessToken: 'live-access-token',
  accessTokenExpiresAt: Date.now() + 10 * 60 * 1000,
  refreshToken: 'refresh-token-1',
  refreshTokenExpiresAt: Date.now() + 7 * DAY_MS,
  account: { id: 'a', email: 'ana@example.md', locale: 'ro' },
  ...overrides,
});

/** A session whose access token is past the 30 s refresh skew — the rotation case. */
const staleSession = () => sessionWith({ accessTokenExpiresAt: Date.now() + 5_000 });

const requestFor = (pathname: string, session: SessionPayload | null) =>
  new NextRequest(`http://web.test${pathname}`, {
    headers: session
      ? { cookie: `${REFRESH_COOKIE}=${sealSession(session, SECRET)}` }
      : undefined,
  });

/** The successor session as the API would answer it. */
const refreshAnswers = (session: SessionPayload) => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        object: {
          accessToken: session.accessToken,
          accessTokenExpiresAt: session.accessTokenExpiresAt,
          refreshToken: session.refreshToken,
          refreshTokenExpiresAt: session.refreshTokenExpiresAt,
          account: session.account,
        },
        messages: [],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ),
  );
};

/**
 * What the downstream render will see. Next carries a proxy's request-header overrides as
 * `x-middleware-request-<name>`, which is how the mutated `Cookie` reaches the Server Component.
 */
const forwardedCookie = (response: Response): string | null =>
  response.headers.get('x-middleware-request-cookie');

const setCookie = (response: Response): string => response.headers.get('set-cookie') ?? '';

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_BASE_URL', 'http://api.test/api/v1');
  vi.stubEnv('SESSION_SECRET', SECRET);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('proxy · page-load rotation', () => {
  it('does not rotate a session whose access token is still good', async () => {
    const response = await proxy(requestFor('/en/organization/users', sessionWith()));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(setCookie(response)).not.toContain(REFRESH_COOKIE);
  });

  it('does not unseal anything on a route that needs no session', async () => {
    const response = await proxy(requestFor('/en/sign-in', staleSession()));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });

  /** The reason this file exists: the render of THIS request must see the new token. */
  it('forwards the successor to the same request, not only to the browser', async () => {
    const successor = sessionWith({
      accessToken: 'rotated-access-token',
      refreshToken: 'refresh-token-2',
    });
    refreshAnswers(successor);

    const response = await proxy(requestFor('/en/organization/users', staleSession()));

    const forwarded = forwardedCookie(response);
    expect(forwarded).toContain(REFRESH_COOKIE);
    const sealed = forwarded?.split(`${REFRESH_COOKIE}=`)[1]?.split(';')[0] ?? '';
    expect(unsealSession(sealed, SECRET)?.accessToken).toBe('rotated-access-token');
  });

  it('also sets the successor on the response, with OQ-33 attributes', async () => {
    refreshAnswers(sessionWith({ refreshToken: 'refresh-token-2' }));

    const response = await proxy(requestFor('/en/organization/users', staleSession()));

    const header = setCookie(response);
    expect(header).toContain(REFRESH_COOKIE);
    expect(header.toLowerCase()).toContain('httponly');
    expect(header.toLowerCase()).toContain('samesite=lax');
  });

  /** The API judged the session dead — the cookie is worthless and the gate must take over. */
  it('clears the cookie and redirects to sign-in when the refresh is refused', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: 'about:blank', status: 401 }), {
        status: 401,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );

    const response = await proxy(requestFor('/en/organization/users', staleSession()));

    expect(response.headers.get('location')).toContain('/en/sign-in');
    expect(response.headers.get('location')).toContain('return=');
  });

  /** A network blip must not sign anyone out — the session may be perfectly alive. */
  it('keeps the session and lets the request through when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('econnrefused'));

    const response = await proxy(requestFor('/en/organization/users', staleSession()));

    expect(response.headers.get('location')).toBeNull();
    expect(setCookie(response)).not.toContain(`${REFRESH_COOKIE}=;`);
  });
});
