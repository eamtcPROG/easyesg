import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from './api-outcome';
import { endsSession, outcomeEndsSession } from './session-standing';

/**
 * The one number that says a session has ended (task 92), and the question every read asks of an api
 * answer before concluding *could not load* (task 160). Literals on purpose: these are the wire values.
 */
const problem = (status: number) => ({
  status: API_OUTCOME.Problem,
  problem: { type: 'https://easyesg.md/problems/x', status, title: 'x' },
});

describe('outcomeEndsSession (task 160)', () => {
  it('is a problem answered 401', () => {
    expect(outcomeEndsSession(problem(401))).toBe(true);
  });

  it.each([403, 404, 409, 500])('is not a problem answered %s', (status) => {
    expect(outcomeEndsSession(problem(status))).toBe(false);
  });

  it('is not an api that could not be reached, nor an answer that went through', () => {
    expect(outcomeEndsSession({ status: API_OUTCOME.Unreachable })).toBe(false);
    expect(outcomeEndsSession({ status: API_OUTCOME.Ok, value: null, messages: [] })).toBe(false);
  });

  it('agrees with `endsSession`, which it is built on', () => {
    expect(endsSession(401)).toBe(true);
    expect(endsSession(undefined)).toBe(false);
  });
});
