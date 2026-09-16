import { describe, expect, it, vi } from 'vitest';
import { submitFactor, submitPassword } from './reauthenticate';

/** The two posts (task 92): what leaves, where to, and what a failure to arrive reads as. */
const answering = (status: number, body: unknown) =>
  vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })),
  ) as unknown as typeof fetch;

const password = {
  accountId: 'account-1',
  email: 'ana@example.md',
  password: 'Parola123!',
  remembered: false,
  organizationId: 'organization-1',
};

describe('submitPassword', () => {
  it('posts the command as JSON to the password handler, same-origin', async () => {
    const fetchImpl = answering(200, { status: 'factor-required' });
    await expect(submitPassword({ command: password, fetch: fetchImpl })).resolves.toEqual({
      status: 'factor-required',
    });
    const [path, init] = vi.mocked(fetchImpl).mock.calls[0] ?? [];
    expect(path).toBe('/auth/session/password');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    expect(typeof init?.body === 'string' ? JSON.parse(init.body) : null).toEqual(password);
  });

  it('reads the api’s refusal as a problem, and no arrival as unreachable', async () => {
    const refused = answering(401, { type: 'https://easyesg.md/problems/credential-invalid', status: 401 });
    await expect(submitPassword({ command: password, fetch: refused })).resolves.toMatchObject({
      status: 'problem',
      problem: { status: 401 },
    });

    const failing = vi.fn(() => Promise.reject(new TypeError('network'))) as unknown as typeof fetch;
    await expect(submitPassword({ command: password, fetch: failing })).resolves.toEqual({ status: 'unreachable' });
  });
});

describe('submitFactor', () => {
  it('posts to the factor handler', async () => {
    const fetchImpl = answering(200, { status: 'resumed' });
    await expect(
      submitFactor({ command: { accountId: 'account-1', code: '123456', organizationId: null }, fetch: fetchImpl }),
    ).resolves.toEqual({ status: 'resumed' });
    expect(vi.mocked(fetchImpl).mock.calls[0]?.[0]).toBe('/auth/session/factor');
  });
});
