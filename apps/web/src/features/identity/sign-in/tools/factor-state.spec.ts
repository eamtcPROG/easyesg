import { describe, expect, it } from 'vitest';
import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { FACTOR_ANSWER, FACTOR_LAPSED, type CompleteFactorFailure } from './factor';
import {
  FACTOR_EVENT,
  FACTOR_STANDING,
  INITIAL_FACTOR_STATE,
  factorReducer,
  isLockout,
  type FactorState,
} from './factor-state';

/**
 * The transitions, as a unit spec — which is the reason the reducer is a module rather than a
 * closure inside `FactorForm`. Two of the cases below cannot be reached from a browser journey
 * without waiting five minutes or racing two tabs, and both are exactly where the stale-state
 * defects live.
 *
 * Literals rather than constants where a value is the RSC wire shape (`'problem'`,
 * `'challenge-lapsed'`), per CLAUDE.md's test exception: pinning the constant would let a rename of
 * its *value* pass, and these travel between a Server Action and a client component.
 */
const refusal = (type: string): ApiFailure => ({
  status: API_OUTCOME.Problem,
  problem: { type, status: 403, title: 'x', detail: 'y' },
});

const settled = (result: CompleteFactorFailure) =>
  ({ type: FACTOR_EVENT.SETTLED, result }) as const;

describe('factorReducer', () => {
  it('starts on the authenticator with nothing refused', () => {
    expect(INITIAL_FACTOR_STATE).toEqual({
      answer: 'authenticator',
      standing: { kind: 'open' },
    });
  });

  it('clears the refusal when the reader switches to a recovery code', () => {
    const refused = factorReducer(INITIAL_FACTOR_STATE, settled(refusal(PROBLEM_TYPE.AuthenticationRequired)));
    expect(refused.standing.kind).toBe('refused');

    const switched = factorReducer(refused, {
      type: FACTOR_EVENT.ANSWER_CHOSEN,
      answer: FACTOR_ANSWER.RECOVERY,
    });

    // The defect this reducer exists for: a "that code wasn't accepted" callout above a control
    // the reader has just switched to and never used.
    expect(switched).toEqual({ answer: 'recovery', standing: { kind: 'open' } });
  });

  it('clears the refusal while the next attempt is in flight, and leaves it clear on the way back', () => {
    const refused = factorReducer(INITIAL_FACTOR_STATE, settled(refusal(PROBLEM_TYPE.AuthenticationRequired)));

    const inFlight = factorReducer(refused, { type: FACTOR_EVENT.SUBMITTED });
    expect(inFlight.standing.kind).toBe('open');

    // `undefined` is the redirect winning. The state must not be repainted for the frame before
    // this tree unmounts.
    expect(factorReducer(inFlight, settled(undefined))).toBe(inFlight);
  });

  it('keeps the chosen affordance across a refusal', () => {
    const onRecovery: FactorState = {
      answer: FACTOR_ANSWER.RECOVERY,
      standing: { kind: FACTOR_STANDING.OPEN },
    };

    // A recovery code refused must leave the recovery field showing — bouncing back to six cells
    // would silently discard what the reader typed and tell them to use a device they said they
    // do not have.
    expect(factorReducer(onRecovery, settled(refusal(PROBLEM_TYPE.AuthenticationRequired))).answer).toBe(
      'recovery',
    );
  });

  it('reaches the same lapsed standing from the countdown and from the server', () => {
    const fromClock = factorReducer(INITIAL_FACTOR_STATE, { type: FACTOR_EVENT.WINDOW_CLOSED });
    const fromServer = factorReducer(INITIAL_FACTOR_STATE, settled({ status: FACTOR_LAPSED }));

    // One fact, one sentence: the clock in the browser and the missing cookie on the server are
    // the same thing having happened, and the reader needs the same way out of both.
    expect(fromClock.standing).toEqual({ kind: 'lapsed' });
    expect(fromServer.standing).toEqual(fromClock.standing);
  });

  it('is idempotent once lapsed, so the still-running clock repaints nothing', () => {
    const lapsed = factorReducer(INITIAL_FACTOR_STATE, { type: FACTOR_EVENT.WINDOW_CLOSED });

    // The interval outlives the form it replaced: a fresh object per tick would re-render the
    // callout every fifteen seconds for as long as the reader leaves the tab open.
    expect(factorReducer(lapsed, { type: FACTOR_EVENT.WINDOW_CLOSED })).toBe(lapsed);
  });

  it('replaces a refusal with the lapse rather than showing both', () => {
    const refused = factorReducer(INITIAL_FACTOR_STATE, settled(refusal(PROBLEM_TYPE.AuthenticationRequired)));
    const lapsed = factorReducer(refused, { type: FACTOR_EVENT.WINDOW_CLOSED });

    // The union is what makes this true by construction: there is no field left holding the
    // refusal, so "retype it" cannot render beside "this step is over".
    expect(lapsed.standing).toEqual({ kind: 'lapsed' });
  });
});

describe('isLockout', () => {
  it('is true only for the FR-4 lockout', () => {
    const locked = factorReducer(INITIAL_FACTOR_STATE, settled(refusal(PROBLEM_TYPE.AccountLocked)));
    const wrongCode = factorReducer(INITIAL_FACTOR_STATE, settled(refusal(PROBLEM_TYPE.AuthenticationRequired)));

    // Factor failures count toward the same threshold as the password step (task 27.3), so this
    // step reaches the lockout — and its way out is the reset link, not "try again".
    expect(isLockout(locked.standing)).toBe(true);
    expect(isLockout(wrongCode.standing)).toBe(false);
    expect(isLockout({ kind: FACTOR_STANDING.OPEN })).toBe(false);
    expect(isLockout({ kind: FACTOR_STANDING.LAPSED })).toBe(false);
  });

  it('is false for an unreachable API, which has no reset to offer', () => {
    const offline = factorReducer(INITIAL_FACTOR_STATE, settled({ status: API_OUTCOME.Unreachable }));
    expect(isLockout(offline.standing)).toBe(false);
  });
});
