import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';

/**
 * S-03's acceptance (UC-15, FR-11), with every seam it calls stubbed — **what a refusal offers as its
 * way out** is the subject (task 114). The branch between the two remedies is a status code and a
 * session read, and a browser can reach each arm only by contriving the timing; this pins which arm
 * answers which refusal, and that the session is read only when there is one to read.
 */
const post = vi.hoisted(() => vi.fn());
const destinationForHeldSession = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({ api: { post } }));
vi.mock('@/server/session/post-sign-in', () => ({ destinationForHeldSession }));
vi.mock('@/i18n/navigation', () => ({ redirect }));
vi.mock('next-intl/server', () => ({ getLocale: () => Promise.resolve('ro') }));

import { acceptInvitationAction } from './actions';

const TOKEN = 'tok/en';
const refusal = (status: number) => ({
  status: API_OUTCOME.Problem,
  problem: { type: 'https://easyesg.md/problems/x', title: 'Refuzat', status, detail: 'De ce.' },
});

beforeEach(() => {
  vi.clearAllMocks();
  destinationForHeldSession.mockResolvedValue({ href: '/create-organization' });
});

describe('acceptInvitationAction (task 114)', () => {
  /**
   * The session ended between the render and the press. Sign-in, and back to **this** invitation —
   * it was usable a moment ago — so the token rides in the return path, encoded.
   */
  it('sends a reader whose session ended to sign in and back here, without reading a session', async () => {
    post.mockResolvedValue(refusal(401));

    expect(await acceptInvitationAction({ token: TOKEN })).toEqual({
      ...refusal(401),
      remedy: { kind: 'sign_in', href: '/sign-in?return=%2Finvitation%2Ftok%252Fen' },
    });
    expect(destinationForHeldSession).not.toHaveBeenCalled();
  });

  /**
   * Any other refusal leaves the session as it was: the way out is where that session belongs — read
   * after the attempt, and never a fixed `/home`.
   */
  it.each([403, 409, 410])('offers a signed-in reader their home page after a %s', async (status) => {
    post.mockResolvedValue(refusal(status));

    expect(await acceptInvitationAction({ token: TOKEN })).toEqual({
      ...refusal(status),
      remedy: { kind: 'home', href: '/create-organization' },
    });
    expect(destinationForHeldSession).toHaveBeenCalledOnce();
  });

  it('returns an unreachable api as it is, with no remedy and no session read', async () => {
    post.mockResolvedValue({ status: API_OUTCOME.Unreachable });

    expect(await acceptInvitationAction({ token: TOKEN })).toEqual({ status: API_OUTCOME.Unreachable });
    expect(destinationForHeldSession).not.toHaveBeenCalled();
  });

  it('redirects a success to the home page with the grant, reading no destination', async () => {
    post.mockResolvedValue({ status: API_OUTCOME.Ok, value: { grant: 'created' }, messages: [] });

    await acceptInvitationAction({ token: TOKEN });

    expect(redirect).toHaveBeenCalledWith({ href: '/home?joined=created', locale: 'ro' });
    expect(destinationForHeldSession).not.toHaveBeenCalled();
  });
});
