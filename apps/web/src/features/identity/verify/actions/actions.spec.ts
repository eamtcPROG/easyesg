import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * S-02's confirmation action and the grant it seals (task 155). `setup-grant.spec.ts` pins what the
 * cookie does with what it is given; this pins what it is given — the grant, the address the step names,
 * **the expiry the API answered** rather than one the web tier makes up, and the deep link S-03 handed
 * over — and that an account confirmed straight to active is given nothing.
 *
 * **And, since task 160, who else this browser is signed in as** — asked of the api after the confirmation,
 * never read off the cookie, and reported only when it is a different address from the one confirmed.
 */
const post = vi.hoisted(() => vi.fn());
const holdSetupGrant = vi.hoisted(() => vi.fn());
const accountStillSignedIn = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({ api: { post } }));
vi.mock('@/server/sealed/setup-grant', () => ({ holdSetupGrant }));
vi.mock('@/server/session/held-account', () => ({ accountStillSignedIn }));

import { verifyEmailAction } from './actions';

const EMAIL = 'ion.rusu@example.md';
const TOKEN = 't'.repeat(43);

const verified = (overrides: Record<string, unknown>) => ({
  status: API_OUTCOME.Ok,
  value: { id: 'account-1', email: EMAIL, status: 'awaiting_setup', ...overrides },
  messages: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  accountStillSignedIn.mockResolvedValue(null);
});

describe('verifyEmailAction (task 155)', () => {
  it('seals the grant with the address, the API’s own expiry and the deep link', async () => {
    post.mockResolvedValue(
      verified({ setupGrant: 'g'.repeat(43), setupGrantExpiresAt: 1_790_380_800_000 }),
    );

    await verifyEmailAction({ token: TOKEN, returnTo: '/invitation/token-1' });

    expect(post).toHaveBeenCalledWith('/auth/verify-email', { token: TOKEN });
    expect(holdSetupGrant).toHaveBeenCalledWith({
      grant: 'g'.repeat(43),
      email: EMAIL,
      expiresAt: 1_790_380_800_000,
      returnTo: '/invitation/token-1',
    });
  });

  it('seals nothing for an account the confirmation made active', async () => {
    post.mockResolvedValue(verified({ status: 'active', setupGrant: null, setupGrantExpiresAt: null }));

    await verifyEmailAction({ token: TOKEN });

    expect(holdSetupGrant).not.toHaveBeenCalled();
  });
});

describe('verifyEmailAction — the account this browser still holds (task 160)', () => {
  const HELD = { email: 'ana.popa@example.md', home: '/home' };

  it('reports a different account still signed in here, with where it belongs', async () => {
    post.mockResolvedValue(verified({ status: 'active', setupGrant: null, setupGrantExpiresAt: null }));
    accountStillSignedIn.mockResolvedValue(HELD);

    const result = await verifyEmailAction({ token: TOKEN });

    expect(result).toEqual({
      status: API_OUTCOME.Ok,
      value: { id: 'account-1', email: EMAIL, status: 'active', heldAccount: HELD },
      messages: [],
    });
  });

  it('reports nothing when the account held is the one confirmed, whatever the case', async () => {
    post.mockResolvedValue(verified({ status: 'active', setupGrant: null, setupGrantExpiresAt: null }));
    accountStillSignedIn.mockResolvedValue({ email: EMAIL.toUpperCase(), home: '/home' });

    const result = await verifyEmailAction({ token: TOKEN });

    expect(result.status === API_OUTCOME.Ok && result.value.heldAccount).toBeNull();
  });

  it('returns a refusal as it arrived, without asking who is signed in', async () => {
    const refusal = { status: API_OUTCOME.Problem, problem: { type: 'x', status: 400, title: 'Nu' } };
    post.mockResolvedValue(refusal);

    expect(await verifyEmailAction({ token: TOKEN })).toEqual(refusal);
    expect(accountStillSignedIn).not.toHaveBeenCalled();
  });
});
