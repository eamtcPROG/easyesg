import { describe, expect, it, vi } from 'vitest';
import { signOutHere } from './sign-out';

/** The dialogue's sign-out request (task 92): what leaves, and that no failure stops the reader leaving. */
describe('signOutHere', () => {
  it('asks the session tier to end what this browser holds, same-origin and uncached', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch;
    await signOutHere({ fetch: fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/auth/session', {
      method: 'DELETE',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  });

  it('resolves when the request cannot arrive, so the navigation to sign in still happens', async () => {
    const failing = vi.fn(() => Promise.reject(new TypeError('network'))) as unknown as typeof fetch;
    await expect(signOutHere({ fetch: failing })).resolves.toBeUndefined();
  });
});
