import { describe, expect, it, vi, beforeEach } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * The probe's four answers (task 92): no session and a refused refresh are *ended*; a fresh token and an api
 * that cannot be reached are *held* — the second because the probe must not stop a navigation the proxy
 * would have let through.
 */
const mocks = vi.hoisted(() => ({ readSession: vi.fn(), withFreshAccessToken: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/server/session/session', () => ({
  readSession: mocks.readSession,
  withFreshAccessToken: mocks.withFreshAccessToken,
}));

import { answerSessionStanding } from './session-standing';

const session = { account: { id: 'account-1' } };

beforeEach(() => vi.clearAllMocks());

describe('answerSessionStanding', () => {
  it('answers 401 authentication-required with no session, and asks for no refresh', async () => {
    mocks.readSession.mockResolvedValue(null);
    const response = await answerSessionStanding();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ type: 'https://easyesg.md/problems/authentication-required' });
    expect(mocks.withFreshAccessToken).not.toHaveBeenCalled();
  });

  it('answers 401 when the api refuses the refresh', async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.withFreshAccessToken.mockResolvedValue({
      failure: { status: API_OUTCOME.Problem, problem: { type: 'https://easyesg.md/problems/session-expired', status: 401 } },
    });
    expect((await answerSessionStanding()).status).toBe(401);
  });

  it('answers 204 for a held session, and for an api that could not be reached', async () => {
    mocks.readSession.mockResolvedValue(session);
    mocks.withFreshAccessToken.mockResolvedValue({ session });
    expect((await answerSessionStanding()).status).toBe(204);

    mocks.withFreshAccessToken.mockResolvedValue({ failure: { status: API_OUTCOME.Unreachable } });
    expect((await answerSessionStanding()).status).toBe(204);
  });
});
