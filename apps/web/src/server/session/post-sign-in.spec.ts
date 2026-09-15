import { ACCOUNT_STATUS } from '@easyesg/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * §4.3's two server seams, on the one question task 155 put in front of both: is the session's account
 * still completing its setup? If so neither may read memberships — the API refuses such an account that
 * read, and the refusal would land it on S-35 as *organization unavailable*.
 *
 * `post-sign-in.ts` records that the difference between the two seams — cached or not — cannot be
 * unit-tested, and that stays true; what is pinned here is the short-circuit ahead of it, which the
 * proxy would otherwise mask in a browser, since a reader turned the wrong way still ends on S-36.
 */
vi.mock('server-only', () => ({}));

const readSession = vi.hoisted(() => vi.fn());
const readMemberships = vi.hoisted(() => vi.fn());
const getList = vi.hoisted(() => vi.fn());

vi.mock('./session', () => ({ readSession }));
vi.mock('../data/memberships', () => ({ readMemberships }));
vi.mock('../api/api-client', () => ({ api: { getList } }));

import { destinationForHeldSession, resolvePostSignIn } from './post-sign-in';

const sessionOf = (status: string) => ({ account: { status } });

beforeEach(() => {
  vi.clearAllMocks();
  readMemberships.mockResolvedValue([]);
  getList.mockResolvedValue({ status: 'ok', value: { items: [] }, messages: [] });
});

describe('§4.3 for an account in setup (task 155)', () => {
  it('sends a held session to S-36 without reading memberships', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));

    const target = await destinationForHeldSession();

    expect(target.href).toBe('/complete-account');
    expect(readMemberships).not.toHaveBeenCalled();
  });

  it('sends a session just issued to S-36 with its deep link, without reading memberships', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));

    const target = await resolvePostSignIn('/invitation/token-1');

    expect(target.href).toBe(`/complete-account?return=${encodeURIComponent('/invitation/token-1')}`);
    expect(getList).not.toHaveBeenCalled();
  });

  it('reads memberships for an active account, on both seams', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));

    await destinationForHeldSession();
    await resolvePostSignIn();

    expect(readMemberships).toHaveBeenCalledTimes(1);
    expect(getList).toHaveBeenCalledTimes(1);
  });
});
