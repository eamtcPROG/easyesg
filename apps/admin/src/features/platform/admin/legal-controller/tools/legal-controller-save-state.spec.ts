import { describe, expect, it } from 'vitest';
import { PROBLEM_TYPE, type ApiFailure } from '@easyesg/contracts';
import {
  INITIAL_LEGAL_CONTROLLER_SAVE_STATE,
  LEGAL_CONTROLLER_SAVE_EVENT,
  legalControllerSaveReducer,
} from './legal-controller-save-state';

const problem = (type: string): ApiFailure => ({
  status: 'problem',
  problem: { type, title: 'Refused', detail: 'Refused, and why.', status: 409 },
});

const pending = legalControllerSaveReducer(INITIAL_LEGAL_CONTROLLER_SAVE_STATE, {
  type: LEGAL_CONTROLLER_SAVE_EVENT.STARTED,
});

describe('A-21’s save state (task 75)', () => {
  it('retires the last notice when a save starts, and says it was saved when it succeeds', () => {
    const done = legalControllerSaveReducer(pending, { type: LEGAL_CONTROLLER_SAVE_EVENT.SUCCEEDED });
    expect(done).toEqual({ pending: false, notice: { kind: 'done' } });
    expect(legalControllerSaveReducer(done, { type: LEGAL_CONTROLLER_SAVE_EVENT.STARTED })).toEqual({
      pending: true,
      notice: null,
    });
  });

  it('draws a colleague’s save as the conflict state, and any other refusal as the api worded it', () => {
    expect(
      legalControllerSaveReducer(pending, {
        type: LEGAL_CONTROLLER_SAVE_EVENT.REFUSED,
        failure: problem(PROBLEM_TYPE.LegalControllerChanged),
      }),
    ).toEqual({ pending: false, notice: { kind: 'changed' } });

    const refusal = problem('https://easyesg.md/problems/validation-failed');
    expect(
      legalControllerSaveReducer(pending, { type: LEGAL_CONTROLLER_SAVE_EVENT.REFUSED, failure: refusal }),
    ).toEqual({ pending: false, notice: { kind: 'refused', failure: refusal } });
  });

  it('ignores an answer with no save in flight, and closes a notice when dismissed', () => {
    expect(
      legalControllerSaveReducer(INITIAL_LEGAL_CONTROLLER_SAVE_STATE, { type: LEGAL_CONTROLLER_SAVE_EVENT.SUCCEEDED }),
    ).toBe(INITIAL_LEGAL_CONTROLLER_SAVE_STATE);
    const done = legalControllerSaveReducer(pending, { type: LEGAL_CONTROLLER_SAVE_EVENT.SUCCEEDED });
    expect(legalControllerSaveReducer(done, { type: LEGAL_CONTROLLER_SAVE_EVENT.NOTICE_DISMISSED }).notice).toBeNull();
  });
});
