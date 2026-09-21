import { ACCOUNT_STATUS } from '@easyesg/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * §4.3's three server seams, on the three questions put in front of them.
 *
 * **Is the session's account still completing its setup?** (task 155) If so none may read memberships —
 * the API refuses such an account that read, and the refusal would land it on S-35 as *organization
 * unavailable*.
 *
 * **Has the api ended the session the cookie still names?** (task 160) That answer is sign-in, not S-35 —
 * whose first sentence is that sign-in succeeded. A session in setup is asked it too, through
 * `GET /account/setup`, because S-36 sends an ended session to sign in and the gate would otherwise send
 * it straight back.
 *
 * **Which client asks?** (task 161) The api client sends an ended session to sign in from inside the read,
 * so the seam that *follows* the branch must read what the chrome reads — its redirect is then the
 * chrome's — and the seams whose callers *act on* the ending must read through the client that hands it
 * back. A seam reading the other one's client is the defect this block pins: the gate would redirect to
 * itself, or S-35 would race the chrome to a different address.
 *
 * `post-sign-in.ts` records that the cached-or-not difference cannot be unit-tested, and that stays true;
 * what is pinned here is the branching ahead of it, which the proxy would otherwise mask in a browser,
 * since a reader turned the wrong way still ends somewhere plausible.
 */
vi.mock('server-only', () => ({}));

const readSession = vi.hoisted(() => vi.fn());
const readMembershipsOutcome = vi.hoisted(() => vi.fn());
const readAccountSetup = vi.hoisted(() => vi.fn());
const observing = vi.hoisted(() => ({ get: vi.fn(), getList: vi.fn() }));

vi.mock('./session', () => ({ readSession }));
vi.mock('../data/memberships', () => ({ readMembershipsOutcome }));
vi.mock('../data/account-setup', () => ({ readAccountSetup }));
vi.mock('../api/api-client', () => ({ observingApi: observing }));

import { destinationForHeldSession, observeHeldSession, resolvePostSignIn } from './post-sign-in';

const sessionOf = (status: string) => ({ account: { status } });
const listOf = (items: unknown[]) => ({ status: 'ok', value: { items }, messages: [] });
const setupRead = { status: 'ok', value: {}, messages: [] };
const refused = (input: { readonly slug: string; readonly status: number }) => ({
  status: 'problem',
  problem: { type: `https://easyesg.md/problems/${input.slug}`, status: input.status, title: 'Refuzat' },
});
const ended = refused({ slug: 'authentication-required', status: 401 });
const oneActive = [{ id: 'm-a', organizationId: 'a', active: true }];

beforeEach(() => {
  vi.clearAllMocks();
  readMembershipsOutcome.mockResolvedValue(listOf([]));
  readAccountSetup.mockResolvedValue(setupRead);
  observing.getList.mockResolvedValue(listOf([]));
  observing.get.mockResolvedValue(setupRead);
});

describe('§4.3 for an account in setup (task 155)', () => {
  it.each([
    ['following', destinationForHeldSession],
    ['observing', observeHeldSession],
  ])('sends a held session to S-36 without reading memberships, %s', async (_label, seam) => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));

    expect((await seam()).href).toBe('/complete-account');
    expect(readMembershipsOutcome).not.toHaveBeenCalled();
    expect(observing.getList).not.toHaveBeenCalled();
  });

  it('sends a session just issued to S-36 with its deep link, without reading memberships', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));

    const target = await resolvePostSignIn('/invitation/token-1');

    expect(target.href).toBe(`/complete-account?return=${encodeURIComponent('/invitation/token-1')}`);
    expect(observing.getList).not.toHaveBeenCalled();
    expect(observing.get).not.toHaveBeenCalled();
  });
});

describe('which client each seam reads through (task 161)', () => {
  it("follows the branch over the chrome's own reads, and never the observing client", async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    await destinationForHeldSession();
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));
    await destinationForHeldSession();

    expect(readMembershipsOutcome).toHaveBeenCalledTimes(1);
    expect(readAccountSetup).toHaveBeenCalledTimes(1);
    expect(observing.getList).not.toHaveBeenCalled();
    expect(observing.get).not.toHaveBeenCalled();
  });

  it("observes through the client that hands the ending back, and never the chrome's reads", async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    await observeHeldSession();
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));
    await observeHeldSession();

    expect(observing.getList).toHaveBeenCalledWith('/memberships');
    expect(observing.get).toHaveBeenCalledWith('/account/setup');
    expect(readMembershipsOutcome).not.toHaveBeenCalled();
    expect(readAccountSetup).not.toHaveBeenCalled();
  });

  it('resolves a session just issued through the observing client too', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));

    await resolvePostSignIn();

    expect(observing.getList).toHaveBeenCalledWith('/memberships');
    expect(readMembershipsOutcome).not.toHaveBeenCalled();
  });
});

describe('§4.3 for a session the api has ended (tasks 160, 161)', () => {
  it.each(['authentication-required', 'session-expired'])(
    'answers sign-in for a held active session refused %s, not S-35',
    async (slug) => {
      readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
      observing.getList.mockResolvedValue(refused({ slug, status: 401 }));

      expect((await observeHeldSession()).href).toBe('/sign-in');
    },
  );

  it.each([
    ['a 500', refused({ slug: 'internal', status: 500 })],
    ['an unreachable api', { status: 'unreachable' }],
  ])('still sends a held session whose read failed with %s to S-35', async (_label, outcome) => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    observing.getList.mockResolvedValue(outcome);
    readMembershipsOutcome.mockResolvedValue(outcome);

    expect((await observeHeldSession()).href).toBe('/organization-unavailable');
    expect((await destinationForHeldSession()).href).toBe('/organization-unavailable');
  });

  it('asks a held session in setup whether it survived, and answers sign-in for an ended one', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));
    observing.get.mockResolvedValue(ended);

    expect((await observeHeldSession()).href).toBe('/sign-in');
    expect(observing.get).toHaveBeenCalledTimes(1);
  });

  it('keeps a held session in setup that answered anything but an ending on S-36', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.AWAITING_SETUP));
    observing.get.mockResolvedValue(refused({ slug: 'account-setup-required', status: 403 }));

    expect((await observeHeldSession()).href).toBe('/complete-account');
  });

  it('answers sign-in for a session just issued and already refused, whatever it was returning to', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    observing.getList.mockResolvedValue(ended);

    expect((await resolvePostSignIn('/reports')).href).toBe('/sign-in');
  });

  it('leaves a live session where the branch sends it, on both held-session seams', async () => {
    readSession.mockResolvedValue(sessionOf(ACCOUNT_STATUS.ACTIVE));
    readMembershipsOutcome.mockResolvedValue(listOf(oneActive));
    observing.getList.mockResolvedValue(listOf(oneActive));

    expect((await destinationForHeldSession()).href).toBe('/home');
    expect((await observeHeldSession()).href).toBe('/home');
  });
});
