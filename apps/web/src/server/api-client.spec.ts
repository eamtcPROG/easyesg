import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The client seam against a stubbed `fetch` — every §6.8 shape the wire can take, each pinned
 * once here so no screen ever has to know them.
 *
 * `server-only` is mocked because it throws outside a React Server environment by design;
 * `next-intl/server` because the ambient locale is request state this unit does not have. The
 * mocks are the seam's OWN dependencies, not the thing under test.
 */
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getLocale: () => Promise.resolve('ro') }));

/** The request's cookie view, settable per test — the seam reads the sealed session from it. */
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    }),
}));

import { API_OUTCOME } from '@/lib/api-outcome';
import { REFRESH_COOKIE } from '@/lib/session-cookie';
import { api } from './api-client';
import { sealSession, type SessionPayload } from './session-codec';

const fetchMock = vi.fn();

const jsonResponse = (body: unknown, init?: { status?: number; contentType?: string }) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': init?.contentType ?? 'application/json' },
  });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_BASE_URL', 'http://api.test/api/v1');
  vi.stubEnv('SESSION_SECRET', 'spec-secret-0000000000000000000000000000');
  cookieJar.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
};

describe('the api client (§6.8 wire conventions, in one place)', () => {
  it('unwraps the object envelope and surfaces its messages', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        htmlcode: 200,
        object: { id: 'x' },
        messages: [{ type: 'WARNING', key: 'entitlement.quota.approaching', text: 'resolved' }],
      }),
    );

    const outcome = await api.get<{ id: string }>('/things/x');

    expect(outcome).toEqual({
      status: API_OUTCOME.Ok,
      value: { id: 'x' },
      messages: [{ type: 'WARNING', key: 'entitlement.quota.approaching', text: 'resolved' }],
    });
  });

  it('unwraps the list envelope into a ListResult and builds the compact query', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ htmlcode: 200, objects: [{ id: 'a' }], total: 137, totalpages: 6, messages: [] }),
    );

    const outcome = await api.getList<{ id: string }>('/things', {
      filters: [{ field: 'status', values: ['active'] }],
      order: [{ field: 'name', direction: 'asc' }],
      page: 2,
    });

    expect(outcome).toEqual({
      status: API_OUTCOME.Ok,
      value: { items: [{ id: 'a' }], total: 137, totalpages: 6 },
      messages: [],
    });
    expect(decodeURIComponent(lastCall().url)).toBe(
      'http://api.test/api/v1/things?filters=status,active&order=name,asc&page=2',
    );
    expect(lastCall().init.method).toBe('GET');
  });

  it('assembles ambient context at the seam: Accept-Language on every call', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ htmlcode: 200, object: null, messages: [] }));

    await api.get('/things/x');

    expect(lastCall().init.headers).toMatchObject({ 'accept-language': 'ro' });
  });

  it('attaches the access token from the sealed session cookie, and nothing without one (task 22)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ htmlcode: 200, object: null, messages: [] }));

    await api.get('/things/x');
    expect(lastCall().init.headers).not.toHaveProperty('authorization');

    const session: SessionPayload = {
      accessToken: 'live-access-token',
      accessTokenExpiresAt: Date.now() + 10 * 60 * 1000,
      refreshToken: 'refresh-token-1',
      refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      account: { id: 'a', email: 'ana@example.md', locale: 'ro' },
    };
    cookieJar.set(
      REFRESH_COOKIE,
      sealSession(session, 'spec-secret-0000000000000000000000000000'),
    );

    await api.get('/things/x');
    expect(lastCall().init.headers).toMatchObject({ authorization: 'Bearer live-access-token' });
  });

  it('sends a body on delete when one is given — sign-out authenticates by the token it carries', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await api.delete('/auth/session', { refreshToken: 'r-1' });

    expect(lastCall().init.method).toBe('DELETE');
    expect(JSON.parse(lastCall().init.body as string)).toEqual({ refreshToken: 'r-1' });
  });

  it('sends a JSON body on post/patch and none on get/delete', async () => {
    // A fresh Response per call — a body reads once, and this test makes two calls.
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ htmlcode: 200, object: null, messages: [] })),
    );

    await api.patch('/things/x', { name: 'n' });
    expect(lastCall().init.method).toBe('PATCH');
    expect(lastCall().init.body).toBe(JSON.stringify({ name: 'n' }));
    expect(lastCall().init.headers).toMatchObject({ 'content-type': 'application/json' });

    await api.delete('/things/x');
    expect(lastCall().init.method).toBe('DELETE');
    expect(lastCall().init.body).toBeUndefined();
    expect(lastCall().init.headers).not.toMatchObject({ 'content-type': 'application/json' });
  });

  it('returns the problem document as received (errors are not enveloped)', async () => {
    const problem = {
      type: 'https://easyesg.md/problems/conflict',
      status: 409,
      title: 'resolved title',
      detail: 'resolved three-part detail',
    };
    fetchMock.mockResolvedValue(
      jsonResponse(problem, { status: 409, contentType: 'application/problem+json' }),
    );

    const outcome = await api.post('/auth/register', { email: 'x@example.md', password: 'p' });

    expect(outcome).toEqual({ status: API_OUTCOME.Problem, problem });
  });

  it('treats 202/204 as Ok with no value (§6.8 bypasses)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    expect(await api.post('/auth/verification-email', { email: 'x@example.md' })).toEqual({
      status: API_OUTCOME.Ok,
      value: undefined,
      messages: [],
    });

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await api.delete('/things/x')).toEqual({
      status: API_OUTCOME.Ok,
      value: undefined,
      messages: [],
    });
  });

  it('maps a network failure to unreachable — the outcome the bundled catalogue explains', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await api.get('/things/x')).toEqual({ status: API_OUTCOME.Unreachable });
  });

  it('maps a non-problem gateway failure to unreachable — same fact, same remedy', async () => {
    fetchMock.mockResolvedValue(
      new Response('Bad Gateway', { status: 502, headers: { 'content-type': 'text/html' } }),
    );
    expect(await api.get('/things/x')).toEqual({ status: API_OUTCOME.Unreachable });
  });
});

/**
 * The body guards, which exist because the alternative is a silent wrong answer: a blind cast
 * reads a missing `object` as `undefined` and a screen renders that as *empty*. Every case here
 * asserts the outcome is `unreachable` rather than a malformed success — a guard that never
 * fires looks exactly like a guard that passes.
 */
describe('unusable response bodies (readEvent-style guards)', () => {
  // The guards log for a developer; silence the expected noise and assert the body never leaks.
  let logged: unknown[][];

  beforeEach(() => {
    logged = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  });

  const cases: [string, unknown][] = [
    ['a bare array', []],
    ['a JSON scalar', 42],
    ['null', null],
    ['an envelope with no `object` member', { htmlcode: 200, messages: [] }],
    ['an envelope whose `messages` is not an array', { htmlcode: 200, object: {}, messages: 'x' }],
  ];

  for (const [label, body] of cases) {
    it(`rejects ${label} rather than passing undefined to a screen`, async () => {
      fetchMock.mockResolvedValue(jsonResponse(body));
      expect(await api.get('/things/x')).toEqual({ status: API_OUTCOME.Unreachable });
    });
  }

  it('accepts a legitimately null object — nullable is not malformed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ htmlcode: 200, object: null, messages: [] }));
    expect(await api.get('/things/x')).toEqual({
      status: API_OUTCOME.Ok,
      value: null,
      messages: [],
    });
  });

  it('rejects malformed JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('{ not json', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    expect(await api.get('/things/x')).toEqual({ status: API_OUTCOME.Unreachable });
  });

  it('rejects a list envelope missing its counts — a NaN pager renders garbage', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ htmlcode: 200, objects: [], messages: [] }));
    expect(await api.getList('/things')).toEqual({ status: API_OUTCOME.Unreachable });
  });

  it('logs the reason for a developer, never the body (NFR-30)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ htmlcode: 200, messages: [], secret: 'ana.popescu@example.md' }),
    );
    await api.get('/things/x');

    const serialised = JSON.stringify(logged);
    expect(serialised).toContain('/things/x');
    expect(serialised).toContain('result envelope');
    expect(serialised).not.toContain('ana.popescu@example.md');
  });

  describe('a problem document is repaired rather than dropped', () => {
    it('keeps a failure a failure when optional members are absent', async () => {
      // RFC 9457 makes every member optional. Dropping this to `unreachable` would replace
      // "the address is already taken" with "try again later" — a worse answer, not a safer one.
      fetchMock.mockResolvedValue(
        jsonResponse({}, { status: 409, contentType: 'application/problem+json' }),
      );

      expect(await api.post('/auth/register', {})).toEqual({
        status: API_OUTCOME.Problem,
        problem: {
          type: 'about:blank',
          status: 409,
          title: undefined,
          detail: undefined,
          instance: undefined,
          correlationId: undefined,
        },
      });
    });

    it('falls back to the HTTP status when the body omits one', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { type: 'https://easyesg.md/problems/conflict', detail: 'resolved' },
          { status: 409, contentType: 'application/problem+json' },
        ),
      );

      const outcome = await api.post('/auth/register', {});
      expect(outcome).toMatchObject({
        status: API_OUTCOME.Problem,
        problem: { status: 409, detail: 'resolved' },
      });
    });
  });
});
