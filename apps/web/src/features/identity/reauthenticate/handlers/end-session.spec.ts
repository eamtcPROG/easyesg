import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The dialogue's sign-out (task 92): a cross-site request ends nothing; a same-origin one ends what is held. */
const mocks = vi.hoisted(() => ({ endHeldSession: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/server/session/end-held-session', () => ({ endHeldSession: mocks.endHeldSession }));

import { endSession } from './end-session';

const request = (fetchSite: string) =>
  new NextRequest('http://web.test/auth/session', { method: 'DELETE', headers: { 'sec-fetch-site': fetchSite } });

beforeEach(() => vi.clearAllMocks());

describe('endSession', () => {
  it('ends nothing for a cross-site request', async () => {
    expect((await endSession(request('cross-site'))).status).toBe(403);
    expect(mocks.endHeldSession).not.toHaveBeenCalled();
  });

  it('ends what this browser holds, and answers 204', async () => {
    expect((await endSession(request('same-origin'))).status).toBe(204);
    expect(mocks.endHeldSession).toHaveBeenCalledTimes(1);
  });
});
