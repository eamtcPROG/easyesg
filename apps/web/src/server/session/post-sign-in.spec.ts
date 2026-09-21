import { ACCOUNT_STATUS } from '@easyesg/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * §4.3's two server seams, on the two questions put in front of both.
 *
 * **Is the session's account still completing its setup?** (task 155) If so neither may read memberships —
 * the API refuses such an account that read, and the refusal would land it on S-35 as *organization
 * unavailable*.
 *
 * **Has the api ended the session the cookie still names?** (task 160) A 401 on the read the branch rests
 * on is that answer, and it is sign-in, not S-35 — whose first sentence is that sign-in succeeded. The
 * held-session seam asks it of a session in setup too, through `GET /account/setup`, because S-36 sends
 * an ended session to sign in and the gate would otherwise send it straight back.
 *
 * `post-sign-in.ts` records that the difference between the two seams — cached or not — cannot be
 * unit-tested, and that stays true; what is pinned here is the branching ahead of it, which the proxy
 * would otherwise mask in a browser, since a reader turned the wrong way still ends somewhere plausible.
 */
vi.mock('server-only', () => ({}));

const readSession = vi.hoisted(() => vi.fn());
const readMembershipsOutcome = vi.hoisted(() => vi.fn());
const readAccountSetup = vi.hoisted(() => vi.fn());
const getList = vi.hoisted(() => vi.fn());

vi.mock('./session', () => ({ readSession }));
vi.mock('../data/memberships', () => ({ readMembershipsOutcome }));
vi.mock('../data/account-setup', () => ({ readAccountSetup }));
vi.mock('../api/api-client', () => ({ api: { getList } }));

import { destinationForHeldSession, resolvePostSignIn } from './post-sign-in';

const sessionOf = (status: string) => ({ account: { status } });
const listOf = (items: unknown[]) => ({ status: 'ok', value: { items }, messages: [] });
const refused = (status: number) => ({
  status: 'problem',
  problem: { type: 'https://easyesg.md/problems/x', status, title: 'Refuzat' },
});
const oneActive = [{ id: 'm-a', organizationId: 'a', active: true }];

beforeEach(() => {
  vi.clearAllMocks();
  readMembershipsOutcome.mockResolvedValue(listOf([]));
  readAccountSetup.mockResolvedValue({ status: 'ok', value: {}, messages: [] });
  getList.mockResolvedValue(listOf([]));
});

describe('§4.3 for an account in setup (task 155)', () => {
  it('sends a held session to S-36 without reading memberships', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));

    const target = await destinationForHeldSession();

    expect(target.href).toBe('/complete-account');
    expect(readMembershipsOutcome).not.toHaveBeenCalled();
  });

  it('sends a session just issued to S-36 with its deep link, without reading memberships', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));

    const target = await resolvePostSignIn('/invitation/token-1');

    expect(target.href).toBe(`/complete-account?return=${encodeURIComponent('/invitation/token-1')}`);
    expect(getList).not.toHaveBeenCalled();
    expect(readAccountSetup).not.toHaveBeenCalled();
  });

  it('reads memberships for an active account, on both seams', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));

    await destinationForHeldSession();
    await resolvePostSignIn();

    expect(readMembershipsOutcome).toHaveBeenCalledTimes(1);
    expect(getList).toHaveBeenCalledTimes(1);
    expect(readAccountSetup).not.toHaveBeenCalled();
  });
});

describe('§4.3 for a session the api has ended (task 160)', () => {
  it('sends a held active session refused at 401 to sign in, not to S-35', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    readMembershipsOutcome.mockResolvedValue(refused(401));

    expect((await destinationForHeldSession()).href).toBe('/sign-in');
  });

  it.each([
    ['a 500', refused(500)],
    ['an unreachable api', { status: 'unreachable' }],
  ])('still sends a held session whose read failed with %s to S-35', async (_label, outcome) => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    readMembershipsOutcome.mockResolvedValue(outcome);

    expect((await destinationForHeldSession()).href).toBe('/organization-unavailable');
  });

  it('asks a held session in setup whether it survived, and sends an ended one to sign in', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));
    readAccountSetup.mockResolvedValue(refused(401));

    expect((await destinationForHeldSession()).href).toBe('/sign-in');
    expect(readAccountSetup).toHaveBeenCalledTimes(1);
  });

  it('keeps a held session in setup that answered with anything but 401 on S-36', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));
    readAccountSetup.mockResolvedValue(refused(403));

    expect((await destinationForHeldSession()).href).toBe('/complete-account');
  });

  it('sends a session just issued and already refused to sign in, whatever it was returning to', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    getList.mockResolvedValue(refused(401));

    expect((await resolvePostSignIn('/reports')).href).toBe('/sign-in');
  });

  it('leaves a live session where the branch sends it', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    readMembershipsOutcome.mockResolvedValue(listOf(oneActive));

    expect((await destinationForHeldSession()).href).toBe('/home');
  });
});
