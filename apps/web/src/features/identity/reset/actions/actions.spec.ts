import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * S-02's reset action (FR-6, UC-09) and what it says about this browser afterwards (task 160).
 *
 * A reset ends every session of **its own** account. Whether this browser held one of them the cookie
 * cannot say — it outlives its session — so the action asks (`accountStillSignedIn`, which also clears an
 * ended one); what is pinned here is that it asks only after a reset that went through, and hands the answer
 * to the screen unchanged, so a surviving session — another account's — is named rather than sent to a
 * sign-in the gate would turn away.
 */
const post = vi.hoisted(() => vi.fn());
const accountStillSignedIn = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({ api: { post } }));
vi.mock('@/server/session/held-account', () => ({ accountStillSignedIn }));

import { resetPasswordAction } from './actions';

const COMMAND = { token: 'r'.repeat(43), password: 'Parola-Noua1!' };
const accepted = { status: API_OUTCOME.Ok, value: undefined, messages: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resetPasswordAction (task 160)', () => {
  it('reports no held account when this browser held none, or held one the reset ended', async () => {
    post.mockResolvedValue(accepted);
    accountStillSignedIn.mockResolvedValue(null);

    expect(await resetPasswordAction(COMMAND)).toEqual({
      status: API_OUTCOME.Ok,
      value: { heldAccount: null },
      messages: [],
    });
    expect(post).toHaveBeenCalledWith('/auth/password-reset', COMMAND);
    expect(accountStillSignedIn).toHaveBeenCalledOnce();
  });

  it('reports the account whose session survived — another account’s', async () => {
    const held = { email: 'ana.popa@example.md', home: '/home' };
    post.mockResolvedValue(accepted);
    accountStillSignedIn.mockResolvedValue(held);

    const result = await resetPasswordAction(COMMAND);

    expect(result.status === API_OUTCOME.Ok && result.value.heldAccount).toEqual(held);
  });

  it('returns a refused reset as it arrived, and asks nothing about the session', async () => {
    const refusal = { status: API_OUTCOME.Problem, problem: { type: 'x', status: 410, title: 'Expirat' } };
    post.mockResolvedValue(refusal);

    expect(await resetPasswordAction(COMMAND)).toEqual(refusal);
    expect(accountStillSignedIn).not.toHaveBeenCalled();
  });
});
