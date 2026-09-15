import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * S-02's confirmation action and the grant it seals (task 155). `setup-grant.spec.ts` pins what the
 * cookie does with what it is given; this pins what it is given — the grant, the address the step names,
 * **the expiry the API answered** rather than one the web tier makes up, and the deep link S-03 handed
 * over — and that an account confirmed straight to active is given nothing.
 */
const post = vi.hoisted(() => vi.fn());
const holdSetupGrant = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({ api: { post } }));
vi.mock('@/server/sealed/setup-grant', () => ({ holdSetupGrant }));

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
