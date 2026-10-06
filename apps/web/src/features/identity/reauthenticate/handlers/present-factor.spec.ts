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
  get: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  readSession: vi.fn(),
  readFactorState: vi.fn(),
  establishSession: vi.fn(),
  holdFactorChallenge: vi.fn(),
  consumeFactorChallenge: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({
  api: { post: mocks.post, get: mocks.get, put: mocks.put, delete: mocks.remove },
}));
vi.mock('@/server/session/session', () => ({
  readSession: mocks.readSession,
  establishSession: mocks.establishSession,
}));
vi.mock('@/server/data/credentials', () => ({ readFactorState: mocks.readFactorState }));
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
      answeredWith: 'authenticator',
    };
    mocks.post.mockResolvedValue({ status: API_OUTCOME.Ok, value: session, messages: [] });
    expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'resumed' });
    expect(mocks.establishSession).toHaveBeenCalledWith({ session, remembered: false });
    expect(mocks.holdFactorChallenge).not.toHaveBeenCalled();
    // An authenticator's code reads nothing more: there is no count to state (task 190).
    expect(mocks.readFactorState).not.toHaveBeenCalled();
  });

  // Task 190 (UC-195 step 3): a recovery code resumes too, and says how many remain, read once the session exists.
  describe('after a recovery code', () => {
    const session = { kind: 'signed_in', refreshToken: 'refresh', account: { id: 'account-1' }, answeredWith: 'recovery_code' };

    beforeEach(() => {
      mocks.consumeFactorChallenge.mockResolvedValue(held);
      mocks.post.mockResolvedValue({ status: API_OUTCOME.Ok, value: session, messages: [] });
    });

    it('answers the codes left from the account state, after the session is written', async () => {
      mocks.readFactorState.mockResolvedValue({ enrolled: true, recoveryCodesRemaining: 7, enrolmentPromptDismissed: false });
      expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'recovered', remaining: 7 });
      expect(mocks.establishSession.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.readFactorState.mock.invocationCallOrder[0],
      );
    });

    it('answers no count, rather than a guess, when that read fails', async () => {
      mocks.readFactorState.mockResolvedValue(null);
      expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'recovered', remaining: null });
    });

    // The gate review's proven gap: a recovery that signed in someone else is refused like any other, and reads
    // nothing under a session that was never written (task 35.2's rule — a queue is never sent as another account).
    it('still refuses when the api answered another account, and reads no count', async () => {
      mocks.post.mockResolvedValue({
        status: API_OUTCOME.Ok,
        value: { ...session, account: { id: 'someone-else' } },
        messages: [],
      });
      expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'account-changed' });
      expect(mocks.establishSession).not.toHaveBeenCalled();
      expect(mocks.readFactorState).not.toHaveBeenCalled();
    });
  });

  it('refuses while another account holds the browser, before the challenge is spent', async () => {
    mocks.readSession.mockResolvedValue({ account: { id: 'someone-else' } });
    expect(await (await presentFactor(request(command))).json()).toEqual({ status: 'account-changed' });
    expect(mocks.consumeFactorChallenge).not.toHaveBeenCalled();
  });
});
