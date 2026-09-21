import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * UX-136's gate on the screens that issue a session (task 112), and the answer task 160 added to the branch
 * it follows. A session the api has ended is answered *sign-in*, which is the screen being gated — so the
 * gate serves the form for it. Redirecting instead would send `/sign-in` to itself.
 */
vi.mock('server-only', () => ({}));

const readSession = vi.hoisted(() => vi.fn());
const observeHeldSession = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock('./session', () => ({ readSession }));
vi.mock('./post-sign-in', () => ({ observeHeldSession }));
vi.mock('@/i18n/navigation', () => ({ redirect }));

import { redirectWhenSignedIn } from './session-entry';

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ account: { status: 'active' } });
});

describe('redirectWhenSignedIn', () => {
  it('serves the form to a reader holding no cookie, asking nothing', async () => {
    readSession.mockResolvedValue(null);

    await redirectWhenSignedIn({ locale: 'ro' });

    expect(observeHeldSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('turns a live session away to where the branch sends it', async () => {
    observeHeldSession.mockResolvedValue({ href: '/home' });

    await redirectWhenSignedIn({ locale: 'ro' });

    expect(redirect).toHaveBeenCalledWith({ href: '/home', locale: 'ro' });
  });

  it('serves the form to a session the api has ended, rather than redirecting to itself (task 160)', async () => {
    observeHeldSession.mockResolvedValue({ href: '/sign-in' });

    await redirectWhenSignedIn({ locale: 'ro' });

    expect(redirect).not.toHaveBeenCalled();
  });
});
