import { PROBLEM_TYPE } from '@easyesg/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * S-36's link-step action (task 155), with every seam it calls stubbed — the wiring between them is the
 * subject. `grant-put-back.spec.ts` pins which refusals leave a grant worth holding and
 * `setup-grant.spec.ts` the cookie; what only this can see is that the action **asks** the one and
 * **calls** the other, and that the *keep me signed in* answer reaches the API rather than stopping at
 * the web tier's own cookie — which a browser check of the cookie's expiry cannot tell apart.
 */
const post = vi.hoisted(() => vi.fn());
const consumeSetupGrant = vi.hoisted(() => vi.fn());
const holdSetupGrant = vi.hoisted(() => vi.fn());
const establishSession = vi.hoisted(() => vi.fn());
const resolvePostSignIn = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({ api: { post } }));
vi.mock('@/server/sealed/setup-grant', () => ({ consumeSetupGrant, holdSetupGrant }));
vi.mock('@/server/session/session', () => ({
  establishSession,
  readSession: vi.fn(),
  rememberLocale: vi.fn(),
  renewSession: vi.fn(),
}));
vi.mock('@/server/session/post-sign-in', () => ({ resolvePostSignIn }));
vi.mock('@/i18n/navigation', () => ({ redirect }));
vi.mock('next-intl/server', () => ({ getLocale: () => Promise.resolve('ro') }));

import { SETUP_GRANT_LAPSED } from '../tools/password-step';
import { setFirstPasswordByGrantAction } from './actions';

const PASSWORD = 'Parola-Noua1!';
const held = {
  grant: 'g'.repeat(43),
  email: 'ion.rusu@example.md',
  expiresAt: 1_790_380_800_000,
  returnTo: '/invitation/token-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  consumeSetupGrant.mockResolvedValue(held);
  establishSession.mockResolvedValue({ account: { status: 'awaiting_setup', locale: 'ro' } });
});

describe('setFirstPasswordByGrantAction (task 155)', () => {
  it('answers the lapse without asking the API when no grant is held', async () => {
    consumeSetupGrant.mockResolvedValue(null);

    expect(await setFirstPasswordByGrantAction({ password: PASSWORD, remember: true })).toEqual({
      status: SETUP_GRANT_LAPSED,
    });
    expect(post).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'sends the keep-me-signed-in answer (%s) to the API, and seals the session to match',
    async (remember) => {
      post.mockResolvedValue({ status: API_OUTCOME.Ok, value: {}, messages: [] });

      await setFirstPasswordByGrantAction({ password: PASSWORD, remember });

      expect(post).toHaveBeenCalledWith('/auth/account-setup/password', {
        grant: held.grant,
        password: PASSWORD,
        remember,
      });
      expect(establishSession).toHaveBeenCalledWith(expect.objectContaining({ remembered: remember }));
      expect(holdSetupGrant).not.toHaveBeenCalled();
    },
  );

  it('puts back exactly the grant it took when the API never answered', async () => {
    post.mockResolvedValue({ status: API_OUTCOME.Unreachable });

    await setFirstPasswordByGrantAction({ password: PASSWORD, remember: false });

    expect(holdSetupGrant).toHaveBeenCalledWith(held);
    expect(establishSession).not.toHaveBeenCalled();
  });

  it('does not put back a grant the API found no live grant for', async () => {
    post.mockResolvedValue({
      status: API_OUTCOME.Problem,
      problem: { type: PROBLEM_TYPE.AccountSetupProofStale, status: 403 },
    });

    await setFirstPasswordByGrantAction({ password: PASSWORD, remember: false });

    expect(holdSetupGrant).not.toHaveBeenCalled();
  });
});
