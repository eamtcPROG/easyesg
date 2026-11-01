import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * The password handler's decisions (task 92) — the branches no browser journey reaches: a cross-site write,
 * another account already in the browser, and a sign-in that answers someone other than the screen's
 * account. The api client, the session tier and the sealed challenge are the handler's dependencies and
 * are stubbed; what is asserted is what the handler asks of them and what it answers.
 */
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  readSession: vi.fn(),
  establishSession: vi.fn(),
  holdFactorChallenge: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({
  api: { post: mocks.post, put: mocks.put, delete: mocks.remove },
}));
vi.mock('@/server/session/session', () => ({
  readSession: mocks.readSession,
  establishSession: mocks.establishSession,
}));
vi.mock('@/server/sealed/factor-challenge', () => ({ holdFactorChallenge: mocks.holdFactorChallenge }));

import { presentPassword } from './present-password';

const command = {
  accountId: 'account-1',
  email: 'ana@example.md',
  password: 'Parola123!',
  remembered: true,
  organizationId: 'organization-1',
};

const request = (body: unknown, fetchSite = 'same-origin') =>
  new NextRequest('http://web.test/auth/session/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': fetchSite },
    body: JSON.stringify(body),
  });

const sessionFor = (accountId: string) => ({
  kind: 'signed_in',
  accessToken: 'access',
  accessTokenExpiresAt: 1,
  refreshToken: `refresh-${accountId}`,
  refreshTokenExpiresAt: 2,
  account: { id: accountId, email: 'ana@example.md', displayName: 'Ana', monogram: null, locale: 'ro', status: 'active' },
});

const answered = (value: unknown) => ({ status: API_OUTCOME.Ok, value, messages: [] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSession.mockResolvedValue(null);
  mocks.put.mockResolvedValue(answered(undefined));
  mocks.remove.mockResolvedValue(answered(undefined));
});

describe('presentPassword', () => {
  it('refuses a cross-site write, and a body that is not a password submission, asking the api nothing', async () => {
    expect((await presentPassword(request(command, 'cross-site'))).status).toBe(403);
    expect((await presentPassword(request({ ...command, password: '' }))).status).toBe(400);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('refuses while this browser holds another account’s session, before the api is asked (UX-136)', async () => {
    mocks.readSession.mockResolvedValue({ account: { id: 'someone-else' } });
    const response = await presentPassword(request(command));
    expect(await response.json()).toEqual({ status: 'account-changed' });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.establishSession).not.toHaveBeenCalled();
  });

  it('signs the same account in again over a session the browser still holds, which may be revoked', async () => {
    mocks.readSession.mockResolvedValue({ account: { id: 'account-1' } });
    mocks.post.mockResolvedValue(answered(sessionFor('account-1')));
    expect(await (await presentPassword(request(command))).json()).toEqual({ status: 'resumed' });
    expect(mocks.establishSession).toHaveBeenCalledTimes(1);
  });

  it('holds a second factor’s challenge sealed, as S-01 does, and asks for the code', async () => {
    mocks.post.mockResolvedValue(answered({ kind: 'challenged', challenge: 'challenge-1', expiresAt: 99 }));
    const response = await presentPassword(request(command));
    expect(await response.json()).toEqual({ status: 'factor-required' });
    expect(mocks.post).toHaveBeenCalledWith('/auth/session', {
      email: 'ana@example.md',
      password: 'Parola123!',
      remember: true,
    });
    expect(mocks.holdFactorChallenge).toHaveBeenCalledWith({ challenge: 'challenge-1', expiresAt: 99, remember: true });
    expect(mocks.establishSession).not.toHaveBeenCalled();
  });

  it('ends a session that answered another account, and writes no cookie for it', async () => {
    mocks.post.mockResolvedValue(answered(sessionFor('someone-else')));
    const response = await presentPassword(request(command));
    expect(await response.json()).toEqual({ status: 'account-changed' });
    expect(mocks.remove).toHaveBeenCalledWith('/auth/session', { refreshToken: 'refresh-someone-else' });
    expect(mocks.establishSession).not.toHaveBeenCalled();
  });

  it('resumes the screen’s account with the choice it made, and restores the organization it was read under', async () => {
    const session = sessionFor('account-1');
    mocks.post.mockResolvedValue(answered(session));
    expect(await (await presentPassword(request(command))).json()).toEqual({ status: 'resumed' });
    expect(mocks.establishSession).toHaveBeenCalledWith({ session, remembered: true });
    expect(mocks.put).toHaveBeenCalledWith('/session/organization', { organizationId: 'organization-1' });

    mocks.put.mockClear();
    await presentPassword(request({ ...command, organizationId: null }));
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('relays the api’s refusal at its own status with its own words, and says 503 where it said nothing', async () => {
    const problem = { type: 'https://easyesg.md/problems/credential-invalid', status: 401, title: 'Refuzat' };
    mocks.post.mockResolvedValue({ status: API_OUTCOME.Problem, problem });
    const refused = await presentPassword(request(command));
    expect(refused.status).toBe(401);
    expect(await refused.json()).toEqual(problem);

    mocks.post.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    expect((await presentPassword(request(command))).status).toBe(503);
  });
});
