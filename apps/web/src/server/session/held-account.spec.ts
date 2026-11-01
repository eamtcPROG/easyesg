import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The account this browser still holds after an S-02 action (task 160). What only this can see: that the
 * answer comes from asking the api — the branch — rather than from the cookie, and that an ended session
 * is cleared here, where a cookie write is legal, rather than reported as held.
 */
vi.mock('server-only', () => ({}));

const readSession = vi.hoisted(() => vi.fn());
const destroySession = vi.hoisted(() => vi.fn());
const observeHeldSession = vi.hoisted(() => vi.fn());

vi.mock('./session', () => ({ readSession, destroySession }));
vi.mock('./post-sign-in', () => ({ observeHeldSession }));

import { accountStillSignedIn } from './held-account';

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ account: { email: 'ana.popa@example.md' } });
});

describe('accountStillSignedIn (task 160)', () => {
  it('is nothing, and asks nothing, when the browser holds no session', async () => {
    readSession.mockResolvedValue(null);

    expect(await accountStillSignedIn()).toBeNull();
    expect(observeHeldSession).not.toHaveBeenCalled();
    expect(destroySession).not.toHaveBeenCalled();
  });

  it('clears a session the api has ended, and reports none', async () => {
    observeHeldSession.mockResolvedValue({ href: '/sign-in' });

    expect(await accountStillSignedIn()).toBeNull();
    expect(destroySession).toHaveBeenCalledOnce();
  });

  it.each(['/home', '/create-organization', '/organization-unavailable'])(
    'reports a surviving session with where it belongs (%s), and clears nothing',
    async (href) => {
      observeHeldSession.mockResolvedValue({ href });

      expect(await accountStillSignedIn()).toEqual({ email: 'ana.popa@example.md', home: href });
      expect(destroySession).not.toHaveBeenCalled();
    },
  );
});
