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
import { sealSession, unsealSession, type SessionPayload } from '@/server/session/session-codec';
import proxy from './proxy';

const SECRET = 'spec-secret-0000000000000000000000000000';
const DAY_MS = 24 * 60 * 60 * 1000;

const fetchMock = vi.fn();

const sessionWith = (overrides: Partial<SessionPayload> = {}): SessionPayload => ({
  accessToken: 'live-access-token',
  accessTokenExpiresAt: Date.now() + 10 * 60 * 1000,
  refreshToken: 'refresh-token-1',
  refreshTokenExpiresAt: Date.now() + 7 * DAY_MS,
  remembered: true,
  account: { id: 'a', email: 'ana@example.md', displayName: 'Ana Popescu', monogram: 'AP', locale: 'ro' },
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
          // **No `remembered` here, deliberately.** `SessionResponse` does not carry one: the API
          // states the session's expiry and never the choice behind it, which is exactly why the
          // web tier seals the flag into its own payload and carries it forward across rotation.
          // A fixture supplying it would be indistinguishable from code that reads it off the
          // response — the one mistake this arrangement exists to prevent.
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

  /** An address that neither needs a session nor issues one pays nothing, not even an unseal.
   *  It named `/en/sign-in` until task 112 moved that route into the rotating set — see the case
   *  below, which is the same property from the other side. */
  it('does not unseal anything on a route that neither needs nor issues a session', async () => {
    const response = await proxy(requestFor('/en/legal/terms', staleSession()));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });

  /**
   * **`/sign-in` rotates too since task 112**, and this is the case that makes the guard on that
   * screen work rather than an optimisation. A signed-in reader landing there resolves §4.3's
   * branch during render; with a sixteen-minute-old access token that read is answered 401, the
   * branch reads the failure as *we could not find out*, and the reader is sent to S-35 —
   * *organization unavailable* — which is a wrong answer stated as a fact. Nothing downstream can
   * fix it, because a Server Component may not write the successor cookie.
   */
  it('rotates on a route that issues a session, so the guard there reads a live token', async () => {
    refreshAnswers(sessionWith({ accessToken: 'rotated-access-token' }));

    const response = await proxy(requestFor('/en/sign-in', staleSession()));

    expect(fetchMock).toHaveBeenCalled();
    const forwarded = forwardedCookie(response);
    const sealed = forwarded?.split(`${REFRESH_COOKIE}=`)[1]?.split(';')[0] ?? '';
    expect(unsealSession({ sealed, secret: SECRET })?.accessToken).toBe('rotated-access-token');
  });

  /** And an anonymous visitor to that same screen still pays nothing: no cookie, no unseal, no
   *  call. This is what keeps the widening above from taxing the product's busiest public page. */
  it('does not reach the api on a session-issuing route with no cookie', async () => {
    const response = await proxy(requestFor('/en/sign-in', null));

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
    expect(unsealSession({ sealed, secret: SECRET })?.accessToken).toBe('rotated-access-token');
  });

  /**
   * **The persistence choice must survive rotation, and nothing observed that it did** (task 97's
   * gate review, which proved the property inert by re-deriving the flag and watching all 250 web
   * tests stay green).
   *
   * It is the defect `session-codec.ts`'s own docblock names: the API's refresh answer states an
   * expiry and never the choice behind it, so a successor built from the response alone becomes
   * *remembered* — and a session the person declined to keep quietly gains a persistent cookie on
   * its first rotation, roughly fifteen minutes in. The rotation path runs here rather than in a
   * Server Action, which is why the assertion belongs in this file.
   */
  it('carries a declined session’s persistence into its successor (OQ-35)', async () => {
    refreshAnswers(sessionWith({ refreshToken: 'refresh-token-2' }));

    const response = await proxy(
      requestFor('/en/organization/users', { ...staleSession(), remembered: false }),
    );

    // The successor the browser is given: session-scoped, as the original was.
    const header = setCookie(response) ?? '';
    expect(header).toContain(REFRESH_COOKIE);
    expect(header.toLowerCase()).not.toContain('max-age');

    // And the successor the seal carries, so the NEXT rotation makes the same decision.
    const sealed = header.split(`${REFRESH_COOKIE}=`)[1]?.split(';')[0] ?? '';
    expect(unsealSession({ sealed, secret: SECRET })?.remembered).toBe(false);
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
    // **The half this test's own name promised and never asserted** (task 112's gate review). The
    // clearing rode the i18n response, which the redirect discards, so the commonest way to reach
    // the gate with a dead session answered no `Set-Cookie` at all.
    expect(setCookie(response)).toContain(`${REFRESH_COOKIE}=;`);
  });

  /**
   * **A cookie that will not unseal is not a session** (task 112).
   *
   * The gate asked `request.cookies.has(REFRESH_COOKIE)` until this task, so a value that failed
   * the ciphertext's authentication tag — a rotated `SESSION_SECRET`, a truncated cookie, a
   * tampered one — walked straight through it. The screen then rendered authenticated with no
   * token for `api-client` to attach, and the reader met an error state where the sign-in screen
   * that would have fixed it belonged. `readSession` had always answered this correctly; the gate
   * was the copy that disagreed.
   *
   * Proven to bite by restoring `cookies.has`, under which this redirects nowhere.
   */
  it('turns away a cookie that does not unseal, as if it were absent', async () => {
    const request = new NextRequest('http://web.test/en/organization/users', {
      headers: { cookie: `${REFRESH_COOKIE}=not-a-sealed-session` },
    });

    const response = await proxy(request);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('/en/sign-in');
    // And it stops being sent: nothing cleared an unsealable cookie before this task.
    expect(setCookie(response)).toContain(`${REFRESH_COOKIE}=;`);
  });

  /**
   * **The `if` in `if (presented)`, which nothing held** (task 112's second gate review: making the
   * delete unconditional left all 362 web tests green).
   *
   * The consequence of losing it is small — a redundant `Set-Cookie` deletion on a bounce from a
   * browser that never had one — and that is exactly why it needs a case: the reasoning behind the
   * condition runs to nine lines of comment and the condition itself was worth nothing.
   */
  it('sends no cookie header when the bounced request carried none', async () => {
    const response = await proxy(requestFor('/en/organization/users', null));

    expect(response.headers.get('location')).toContain('/en/sign-in');
    expect(setCookie(response)).not.toContain(REFRESH_COOKIE);
  });

  /** The same fact from the far end of the session's life: past the refresh bound, the cookie is
   *  worthless whatever it unseals to. `Max-Age` should make it unreachable; a skewed client clock
   *  is not a security boundary, which is the sentence `liveSession` carries. */
  it('turns away a session past its refresh bound', async () => {
    const expired = sessionWith({ refreshTokenExpiresAt: Date.now() - 1_000 });

    const response = await proxy(requestFor('/en/organization/users', expired));

    expect(response.headers.get('location')).toContain('/en/sign-in');
    // A declined session's cookie carries no `Max-Age` (OQ-35), so the browser would keep
    // presenting this dead value for the rest of the tab's life if the gate did not clear it.
    expect(setCookie(response)).toContain(`${REFRESH_COOKIE}=;`);
  });

  /** A network blip must not sign anyone out — the session may be perfectly alive. */
  it('keeps the session and lets the request through when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('econnrefused'));

    const response = await proxy(requestFor('/en/organization/users', staleSession()));

    expect(response.headers.get('location')).toBeNull();
    expect(setCookie(response)).not.toContain(`${REFRESH_COOKIE}=;`);
  });
});
