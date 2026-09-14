import {
  API_OUTCOME,
  type ApiOutcome,
  type ListResult,
  type SupportAccessLogEntry,
} from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { grantReadFailureOf, inProgressOf, logIsMoving, readLogOutcome } from './support-access-read';

const entry = (id: string, state: SupportAccessLogEntry['state']): SupportAccessLogEntry => ({
  id,
  organizationId: 'organization-1',
  requesterEmail: 'ana@easyesg.md',
  ticketReference: 'SUP-4417',
  reason: 'Scope 2 lipsește din export.',
  state,
  requestedAt: 1,
  lapsesAt: 2,
  grantedAt: null,
  expiresAt: null,
  requesterId: 'operator-1',
  organizationName: 'Lactate Nord SA',
  decision: null,
  ended: null,
  accesses: [],
});

const ok = (items: SupportAccessLogEntry[]): ApiOutcome<ListResult<SupportAccessLogEntry>> => ({
  status: API_OUTCOME.Ok,
  value: { items, total: items.length, totalpages: 1 },
  messages: [],
});

describe('A-07’s reads (task 67.9)', () => {
  it('reads a page of the log whole, its total standing for both counts', () => {
    const rows = [entry('a', 'ended')];
    expect(readLogOutcome({ outcome: ok(rows), page: 2 })).toEqual({
      kind: 'ready',
      page: { rows, matched: 1, total: 1, page: 2, pageSize: 50 },
    });
    expect(readLogOutcome({ outcome: { status: API_OUTCOME.Unreachable }, page: 1 })).toEqual({
      kind: 'unavailable',
    });
  });

  it('separates what waits from what runs, and leaves what is over out of both', () => {
    const entries = [entry('a', 'awaiting'), entry('b', 'active'), entry('c', 'expired'), entry('d', 'lapsed')];
    expect(inProgressOf(entries)).toEqual({ awaiting: [entries[0]], active: [entries[1]] });
  });

  it('polls only while something can change without this operator — every read of the log is logged', () => {
    expect(logIsMoving(undefined)).toBe(false);
    expect(logIsMoving({ status: API_OUTCOME.Unreachable })).toBe(false);
    expect(logIsMoving(ok([entry('a', 'ended'), entry('b', 'declined')]))).toBe(false);
    expect(logIsMoving(ok([entry('a', 'ended'), entry('b', 'awaiting')]))).toBe(true);
    expect(logIsMoving(ok([entry('b', 'active')]))).toBe(true);
  });

  it('reads a closed grant as ended rather than as a refused role, though both are 403s', () => {
    expect(
      grantReadFailureOf({
        status: API_OUTCOME.Problem,
        problem: { type: 'https://easyesg.md/problems/support-access-required', status: 403 },
      }),
    ).toEqual({ kind: 'ended' });
    expect(
      grantReadFailureOf({
        status: API_OUTCOME.Problem,
        problem: { type: 'https://easyesg.md/problems/insufficient-role', status: 403 },
      }),
    ).toEqual({ kind: 'forbidden' });
    expect(grantReadFailureOf({ status: API_OUTCOME.Unreachable })).toEqual({ kind: 'unavailable' });
  });
});
