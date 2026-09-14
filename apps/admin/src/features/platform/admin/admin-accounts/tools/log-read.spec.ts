import { describe, expect, it } from 'vitest';
import { API_OUTCOME, type SystemAuditLogEntry } from '@easyesg/contracts';
import { readLogOutcome } from './log-read';
import { readRosterOutcome } from './roster-read';

const entry: SystemAuditLogEntry = {
  id: 'entry-1',
  occurredAt: 1_789_900_000_000,
  action: 'admin.account.suspended',
  actorId: 'operator-1',
  actorEmail: 'ana@easyesg.md',
  targetId: 'account-2',
  targetEmail: 'ion@easyesg.md',
  targetProvider: null,
};

describe('A-08’s reads (task 67.4)', () => {
  it('pages the log from what the filters admitted, and knows how much there is in all', () => {
    expect(
      readLogOutcome({
        outcome: {
          status: API_OUTCOME.Ok,
          value: { items: [entry], total: 1, totalpages: 1, unfiltered: 40 },
          messages: [],
        },
        page: 1,
      }),
    ).toEqual({
      kind: 'ready',
      page: { rows: [entry], matched: 1, total: 40, page: 1, pageSize: 50 },
    });
  });

  it('draws a refused read as the realm’s arm for it', () => {
    const forbidden = {
      status: API_OUTCOME.Problem,
      problem: { type: 'https://easyesg.md/problems/insufficient-role', status: 403 },
    } as const;

    expect(readLogOutcome({ outcome: forbidden, page: 1 })).toEqual({ kind: 'forbidden' });
    expect(readRosterOutcome(forbidden)).toEqual({ kind: 'forbidden' });
    expect(readRosterOutcome({ status: API_OUTCOME.Unreachable })).toEqual({ kind: 'unavailable' });
  });

  it('reads the roster whole', () => {
    const row = {
      id: 'account-2',
      kind: 'account',
      email: 'ion@easyesg.md',
      role: 'billing_operator',
      standing: 'active',
      lastSignInAt: null,
      expiresAt: null,
      supportAccessRequests: 0,
    } as const;

    expect(
      readRosterOutcome({
        status: API_OUTCOME.Ok,
        value: { items: [row], total: 1, totalpages: 1 },
        messages: [],
      }),
    ).toEqual({ kind: 'ready', rows: [row] });
  });
});
