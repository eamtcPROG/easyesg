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

import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from './api-client';

const fetchMock = vi.fn();

const jsonResponse = (body: unknown, init?: { status?: number; contentType?: string }) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': init?.contentType ?? 'application/json' },
  });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_BASE_URL', 'http://api.test/api/v1');
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
