import { describe, expect, it } from 'vitest';
import { API_OUTCOME, PROBLEM_TYPE, type ApiOutcome } from '@easyesg/contracts';
import {
  DECISION,
  DECISION_EVENT,
  INITIAL_DECISION,
  decisionOutcomeOf,
  decisionReducer,
} from './migration-decision';

const problem = (type: string, status: number): ApiOutcome<null> =>
  ({ status: API_OUTCOME.Problem, problem: { type, status, title: 't', detail: 'd' } });

describe('S-49’s decision (task 67.20)', () => {
  it('names each answer: kept, put back, a lock in the way, nothing left to decide, or no answer', () => {
    const ok = { status: API_OUTCOME.Ok, value: null } as ApiOutcome<null>;
    expect(decisionOutcomeOf({ decision: DECISION.KEEP, outcome: ok })).toBe('kept');
    expect(decisionOutcomeOf({ decision: DECISION.PUT_BACK, outcome: ok })).toBe('put-back');
    expect(decisionOutcomeOf({ decision: DECISION.PUT_BACK, outcome: problem(PROBLEM_TYPE.ReportNotEditable, 409) })).toBe('locked');
    expect(decisionOutcomeOf({ decision: DECISION.KEEP, outcome: problem('https://easyesg.md/problems/not-found', 404) })).toBe(
      'nothing-to-decide',
    );
    expect(
      decisionOutcomeOf({ decision: DECISION.KEEP, outcome: { status: API_OUTCOME.Unreachable } }),
    ).toBe('unreachable');
  });

  it('confirms the put-back before sending it, and closes the dialogue as the request starts', () => {
    const asked = decisionReducer(INITIAL_DECISION, { type: DECISION_EVENT.PUT_BACK_ASKED });
    expect(asked).toEqual({ confirmingPutBack: true, pending: null, outcome: null });
    expect(decisionReducer(asked, { type: DECISION_EVENT.PUT_BACK_DISMISSED }).confirmingPutBack).toBe(false);
    expect(decisionReducer(asked, { type: DECISION_EVENT.SUBMITTED, decision: DECISION.PUT_BACK })).toEqual({
      confirmingPutBack: false,
      pending: 'put-back',
      outcome: null,
    });
  });

  it('ends the request with its outcome, and drops a failure’s notice when the reader tries again', () => {
    const answered = decisionReducer(
      { confirmingPutBack: false, pending: DECISION.KEEP, outcome: null },
      { type: DECISION_EVENT.ANSWERED, outcome: 'unreachable' },
    );
    expect(answered).toEqual({ confirmingPutBack: false, pending: null, outcome: 'unreachable' });
    expect(decisionReducer(answered, { type: DECISION_EVENT.SUBMITTED, decision: DECISION.KEEP }).outcome).toBeNull();
  });
});
