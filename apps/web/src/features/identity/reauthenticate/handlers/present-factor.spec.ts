import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * The code handler's decisions (task 92): a challenge that is gone, a code refused — which must leave the
 * challenge standing, as S-01's step does — and the keep-me-signed-in choice carried from the password
 * stage into the session.
 */
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  readSession: vi.fn(),
  establishSession: vi.fn(),
  holdFactorChallenge: vi.fn(),
  consumeFactorChallenge: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({
  api: { post: mocks.post, put: mocks.put, delete: mocks.remove },
}));
vi.mock('@/server/session/session', () => ({
  readSession: mocks.readSession,
  establishSession: mocks.establishSession,
}));
vi.mock('@/server/sealed/factor-challenge', () => ({
  holdFactorChallenge: mocks.holdFactorChallenge,
  consumeFactorChallenge: mocks.consumeFactorChallenge,
}));

import { presentFactor } from './present-factor';

const command = { accountId: 'account-1', code: '123456', organizationId: null };
const held = { challenge: 'challenge-1', expiresAt: 99, remember: false };

const request = (body: unknown) =>
  new NextRequest('http://web.test/auth/session/factor', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSession.mockResolvedValue(null);
});

describe('presentFactor', () => {
  it('answers a lapse when no challenge is held, and asks the api nothing', async () => {
    mocks.consumeFactorChallenge.mockResolvedValue(null);
    expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'challenge-lapsed' });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('puts the challenge back when the code is refused, so the reader stays at the code', async () => {
    mocks.consumeFactorChallenge.mockResolvedValue(held);
    const problem = { type: 'https://easyesg.md/problems/factor-invalid', status: 401 };
    mocks.post.mockResolvedValue({ status: API_OUTCOME.Problem, problem });
    const response = await presentFactor(request(command));
    expect(response.status).toBe(401);
    expect(mocks.post).toHaveBeenCalledWith('/auth/session/factor', { challenge: 'challenge-1', code: '123456' });
    expect(mocks.holdFactorChallenge).toHaveBeenCalledWith(held);
  });

  it('resumes with the choice the password stage held, not a new one', async () => {
    mocks.consumeFactorChallenge.mockResolvedValue(held);
    const session = {
      kind: 'signed_in',
      refreshToken: 'refresh',
      account: { id: 'account-1' },
    };
    mocks.post.mockResolvedValue({ status: API_OUTCOME.Ok, value: session, messages: [] });
    expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'resumed' });
    expect(mocks.establishSession).toHaveBeenCalledWith({ session, remembered: false });
    expect(mocks.holdFactorChallenge).not.toHaveBeenCalled();
  });

  it('refuses while another account holds the browser, before the challenge is spent', async () => {
    mocks.readSession.mockResolvedValue({ account: { id: 'someone-else' } });
    expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'account-changed' });
    expect(mocks.consumeFactorChallenge).not.toHaveBeenCalled();
  });
});
