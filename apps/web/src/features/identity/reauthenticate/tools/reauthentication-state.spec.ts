import { PROBLEM_TYPE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import { FACTOR_ANSWER, FACTOR_LAPSED } from '../../shared/tools/factor';
import { REAUTHENTICATION, type ReauthenticationAnswer } from './reauthentication-answer';
import {
  INITIAL_REAUTHENTICATION_STATE,
  REAUTHENTICATION_EVENT,
  REAUTHENTICATION_REFUSAL,
  REAUTHENTICATION_STAGE,
  reauthenticationReducer,
  refusalIsLockout,
  type ReauthenticationState,
} from './reauthentication-state';

/** Every transition of the dialogue (task 92), including the lapse no browser journey waits five minutes for. */
const settle = (state: ReauthenticationState, answer: ReauthenticationAnswer) =>
  reauthenticationReducer(state, { type: REAUTHENTICATION_EVENT.SETTLED, answer });

const refused = (type: string): ReauthenticationAnswer => ({
  status: API_OUTCOME.Problem,
  problem: { type, status: 401, title: 'refused' },
});

describe('reauthenticationReducer', () => {
  it('moves to the code, at the authenticator, when the password was right and a factor is held', () => {
    const wrong = settle(INITIAL_REAUTHENTICATION_STATE, refused(PROBLEM_TYPE.AccountLocked));
    const factor = settle(wrong, { status: REAUTHENTICATION.FACTOR_REQUIRED });
    expect(factor).toEqual({
      stage: REAUTHENTICATION_STAGE.FACTOR,
      answer: FACTOR_ANSWER.AUTHENTICATOR,
      refusal: null,
    });
  });

  it('keeps the stage and records a refusal the api gave, or no answer at all', () => {
    const problem = refused('https://easyesg.md/problems/credential-invalid');
    expect(settle(INITIAL_REAUTHENTICATION_STATE, problem)).toEqual({
      ...INITIAL_REAUTHENTICATION_STATE,
      refusal: { kind: REAUTHENTICATION_REFUSAL.FAILED, failure: problem },
    });

    const atCode = settle(INITIAL_REAUTHENTICATION_STATE, { status: REAUTHENTICATION.FACTOR_REQUIRED });
    const unreachable = settle(atCode, { status: API_OUTCOME.Unreachable });
    expect(unreachable.stage).toBe(REAUTHENTICATION_STAGE.FACTOR);
    expect(unreachable.refusal).toEqual({
      kind: REAUTHENTICATION_REFUSAL.FAILED,
      failure: { status: API_OUTCOME.Unreachable },
    });
  });

  it('goes back to the password, and says why, when the code came after the challenge lapsed', () => {
    const atRecovery = reauthenticationReducer(
      settle(INITIAL_REAUTHENTICATION_STATE, { status: REAUTHENTICATION.FACTOR_REQUIRED }),
      { type: REAUTHENTICATION_EVENT.ANSWER_CHOSEN, answer: FACTOR_ANSWER.RECOVERY },
    );
    expect(settle(atRecovery, { status: FACTOR_LAPSED })).toEqual({
      stage: REAUTHENTICATION_STAGE.PASSWORD,
      answer: FACTOR_ANSWER.AUTHENTICATOR,
      refusal: { kind: REAUTHENTICATION_REFUSAL.LAPSED },
    });
  });

  it('names another account without leaving the stage it was met at', () => {
    const changed = settle(INITIAL_REAUTHENTICATION_STATE, { status: REAUTHENTICATION.ACCOUNT_CHANGED });
    expect(changed.stage).toBe(REAUTHENTICATION_STAGE.PASSWORD);
    expect(changed.refusal).toEqual({ kind: REAUTHENTICATION_REFUSAL.ACCOUNT_CHANGED });
  });

  it('writes nothing for a resumption — the dialogue closes because the screen beneath it moved', () => {
    const atCode = settle(INITIAL_REAUTHENTICATION_STATE, { status: REAUTHENTICATION.FACTOR_REQUIRED });
    expect(settle(atCode, { status: REAUTHENTICATION.RESUMED })).toBe(atCode);
  });

  it('clears a refusal on the next attempt and on a change of control, and restarts whole', () => {
    const wrong = settle(INITIAL_REAUTHENTICATION_STATE, refused('https://easyesg.md/problems/credential-invalid'));
    expect(reauthenticationReducer(wrong, { type: REAUTHENTICATION_EVENT.SUBMITTED }).refusal).toBeNull();
    expect(
      reauthenticationReducer(INITIAL_REAUTHENTICATION_STATE, { type: REAUTHENTICATION_EVENT.SUBMITTED }),
    ).toBe(INITIAL_REAUTHENTICATION_STATE);

    const atCode = settle(INITIAL_REAUTHENTICATION_STATE, { status: REAUTHENTICATION.FACTOR_REQUIRED });
    const wrongCode = settle(atCode, refused('https://easyesg.md/problems/factor-invalid'));
    const recovery = reauthenticationReducer(wrongCode, {
      type: REAUTHENTICATION_EVENT.ANSWER_CHOSEN,
      answer: FACTOR_ANSWER.RECOVERY,
    });
    expect(recovery).toEqual({ stage: REAUTHENTICATION_STAGE.FACTOR, answer: FACTOR_ANSWER.RECOVERY, refusal: null });

    expect(reauthenticationReducer(recovery, { type: REAUTHENTICATION_EVENT.RESTARTED })).toEqual(
      INITIAL_REAUTHENTICATION_STATE,
    );
  });
});

describe('refusalIsLockout', () => {
  it('is the lockout problem and nothing else', () => {
    const lockout = settle(INITIAL_REAUTHENTICATION_STATE, refused(PROBLEM_TYPE.AccountLocked)).refusal;
    const wrong = settle(INITIAL_REAUTHENTICATION_STATE, refused('https://easyesg.md/problems/credential-invalid')).refusal;
    const unreachable = settle(INITIAL_REAUTHENTICATION_STATE, { status: API_OUTCOME.Unreachable }).refusal;
    expect(refusalIsLockout(lockout)).toBe(true);
    expect(refusalIsLockout(wrong)).toBe(false);
    expect(refusalIsLockout(unreachable)).toBe(false);
    expect(refusalIsLockout(null)).toBe(false);
  });
});
