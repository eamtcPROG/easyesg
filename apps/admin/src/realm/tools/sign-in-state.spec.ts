import { describe, expect, it } from 'vitest';
import type { ApiFailure } from '@easyesg/contracts';
import {
  INITIAL_SIGN_IN_STATE,
  SIGN_IN_EVENT,
  STEP,
  signInReducer,
  type SignInState,
} from './sign-in-state';

/**
 * A-01's transitions, as a unit spec — the reason the reducer left `sign-in-screen.tsx` (task 135).
 * The lapsed challenge is the case a browser journey reaches only by waiting out five minutes, and
 * the stale-refusal cases are where a two-setter version had to be read line by line to be trusted.
 *
 * `step.kind` is asserted as the literal (`'factor'`, `'credential'`) rather than through `STEP`,
 * per the root file's test exception: a constant-based assertion would pass a renamed value.
 */
const refusal: ApiFailure = {
  status: 'problem',
  problem: { type: 'https://easyesg.md/problems/authentication-failed', status: 401, title: 'x', detail: 'y' },
};

const onFactor: SignInState = { step: { kind: STEP.Factor, email: 'ana@easyesg.md' }, failure: null };

describe('signInReducer (A-01, UC-68)', () => {
  it('opens the factor step for the address the server verified, and drops any refusal', () => {
    const next = signInReducer(
      { ...INITIAL_SIGN_IN_STATE, failure: refusal },
      { type: SIGN_IN_EVENT.CHALLENGE_OPENED, email: 'ana@easyesg.md' },
    );
    expect(next).toEqual({ step: { kind: 'factor', email: 'ana@easyesg.md' }, failure: null });
  });

  it('keeps the reader on the step that asked when the api refuses', () => {
    expect(signInReducer(onFactor, { type: SIGN_IN_EVENT.REFUSED, failure: refusal })).toEqual({
      step: { kind: 'factor', email: 'ana@easyesg.md' },
      failure: refusal,
    });
    expect(
      signInReducer(INITIAL_SIGN_IN_STATE, { type: SIGN_IN_EVENT.REFUSED, failure: refusal }),
    ).toEqual({ step: { kind: 'credential' }, failure: refusal });
  });

  it('returns a lapsed challenge to the credential step and keeps the api’s explanation', () => {
    expect(
      signInReducer(onFactor, { type: SIGN_IN_EVENT.CHALLENGE_LAPSED, failure: refusal }),
    ).toEqual({ step: { kind: 'credential' }, failure: refusal });
  });

  it('clears the previous refusal when a step submits, without moving the step', () => {
    expect(
      signInReducer({ ...onFactor, failure: refusal }, { type: SIGN_IN_EVENT.SUBMITTED }),
    ).toEqual({ step: { kind: 'factor', email: 'ana@easyesg.md' }, failure: null });
  });

  it('starts over from the credential with nothing carried when the reader restarts', () => {
    expect(
      signInReducer({ ...onFactor, failure: refusal }, { type: SIGN_IN_EVENT.RESTARTED }),
    ).toEqual({ step: { kind: 'credential' }, failure: null });
  });

  // Task 151 — the recovery sign-in, and its two ways in.
  it('opens the recovery step from the factor step for the verified address, dropping the refusal', () => {
    expect(
      signInReducer(
        { ...onFactor, failure: refusal },
        { type: SIGN_IN_EVENT.RECOVERY_OPENED, email: 'ana@easyesg.md' },
      ),
    ).toEqual({ step: { kind: 'recovery', email: 'ana@easyesg.md' }, failure: null });
  });

  it('opens the recovery step from a lockout on the credential step, for the refused address', () => {
    expect(
      signInReducer(
        { ...INITIAL_SIGN_IN_STATE, failure: refusal },
        { type: SIGN_IN_EVENT.RECOVERY_OPENED, email: 'ana@easyesg.md' },
      ),
    ).toEqual({ step: { kind: 'recovery', email: 'ana@easyesg.md' }, failure: null });
  });

  it('keeps a refused recovery on its step, and restarts from it with nothing carried', () => {
    const onRecovery: SignInState = {
      step: { kind: STEP.Recovery, email: 'ana@easyesg.md' },
      failure: null,
    };
    expect(signInReducer(onRecovery, { type: SIGN_IN_EVENT.REFUSED, failure: refusal })).toEqual({
      step: { kind: 'recovery', email: 'ana@easyesg.md' },
      failure: refusal,
    });
    expect(
      signInReducer({ ...onRecovery, failure: refusal }, { type: SIGN_IN_EVENT.RESTARTED }),
    ).toEqual({ step: { kind: 'credential' }, failure: null });
  });
});
