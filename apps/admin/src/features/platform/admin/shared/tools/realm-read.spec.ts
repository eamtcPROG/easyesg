import { describe, expect, it } from 'vitest';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import { realmReadFailureOf } from './realm-read';

const problem = (status: number): ApiFailure => ({
  status: API_OUTCOME.Problem,
  problem: { type: 'https://easyesg.md/problems/any', status },
});

describe('realmReadFailureOf (task 67.4)', () => {
  it('reads a 403 as the permission state and a 401 as a session that ended', () => {
    expect(realmReadFailureOf(problem(403))).toEqual({ kind: 'forbidden' });
    expect(realmReadFailureOf(problem(401))).toEqual({ kind: 'signed_out' });
  });

  it('reads every other refusal, and an api it could not reach, as recoverable', () => {
    expect(realmReadFailureOf(problem(500))).toEqual({ kind: 'unavailable' });
    expect(realmReadFailureOf(problem(429))).toEqual({ kind: 'unavailable' });
    expect(realmReadFailureOf({ status: API_OUTCOME.Unreachable })).toEqual({ kind: 'unavailable' });
  });
});
