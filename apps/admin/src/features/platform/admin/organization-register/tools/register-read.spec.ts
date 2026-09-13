import { describe, expect, it } from 'vitest';
import { API_OUTCOME, type OrganizationRegisterRow } from '@easyesg/contracts';
import { REGISTER_READ, readRegisterOutcome } from './register-read';

/** Which arm each answer draws (task 67.3) — the two refusals above all, which mean opposite things. */
const ROW: OrganizationRegisterRow = {
  id: '01920000-0000-7000-8000-000000000001',
  name: 'Brutăria Lina SRL',
  idno: '1009600041284',
  registeredAt: 1_700_000_000_000,
  entityCount: 2,
  reportCount: 1,
  lastSignInAt: null,
};

const problem = (status: number) =>
  ({
    status: API_OUTCOME.Problem,
    problem: { type: 'https://easyesg.md/problems/x', status },
  }) as const;

describe('readRegisterOutcome', () => {
  it('turns a list into the Index page, with every organization as the total', () => {
    expect(
      readRegisterOutcome({
        outcome: {
          status: API_OUTCOME.Ok,
          value: { items: [ROW], total: 1, totalpages: 1, unfiltered: 1284 },
          messages: [],
        },
        page: 2,
      }),
    ).toEqual({
      kind: REGISTER_READ.READY,
      page: { rows: [ROW], matched: 1, total: 1284, page: 2, pageSize: 50 },
    });
  });

  it('reads a 403 as the permission state and a 401 as a session that ended', () => {
    expect(readRegisterOutcome({ outcome: problem(403), page: 1 }).kind).toBe(REGISTER_READ.FORBIDDEN);
    expect(readRegisterOutcome({ outcome: problem(401), page: 1 }).kind).toBe(REGISTER_READ.SIGNED_OUT);
  });

  it('reads any other problem, and an unreachable api, as recoverable', () => {
    expect(readRegisterOutcome({ outcome: problem(500), page: 1 }).kind).toBe(REGISTER_READ.UNAVAILABLE);
    expect(
      readRegisterOutcome({ outcome: { status: API_OUTCOME.Unreachable }, page: 1 }).kind,
    ).toBe(REGISTER_READ.UNAVAILABLE);
  });
});
