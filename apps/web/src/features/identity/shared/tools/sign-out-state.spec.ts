import { describe, expect, it } from 'vitest';
import {
  INITIAL_SIGN_OUT_STATE,
  SIGN_OUT_EVENT,
  SIGN_OUT_STAGE,
  signOutIsAt,
  signOutReducer,
} from './sign-out-state';

/** Every transition of a sign-out met by a queue (task 93), the reader's answer to UX-37's question included. */
const requested = (unsent: boolean) =>
  signOutReducer(INITIAL_SIGN_OUT_STATE, { type: SIGN_OUT_EVENT.REQUESTED, unsent });

describe('signOutReducer', () => {
  it('leaves at once with nothing unsent, and waits with something', () => {
    expect(requested(false)).toEqual({ stage: SIGN_OUT_STAGE.LEAVING });
    expect(requested(true)).toEqual({ stage: SIGN_OUT_STAGE.WAITING });
  });

  it('leaves once what was waiting has gone, and asks once it cannot go', () => {
    expect(signOutReducer(requested(true), { type: SIGN_OUT_EVENT.UNSENT_SENT })).toEqual({
      stage: SIGN_OUT_STAGE.LEAVING,
    });
    expect(signOutReducer(requested(true), { type: SIGN_OUT_EVENT.UNSENT_BLOCKED })).toEqual({
      stage: SIGN_OUT_STAGE.CONFIRMING,
    });
  });

  it('leaves on the reader’s answer, and forgets the whole request on a cancel', () => {
    const asking = signOutReducer(requested(true), { type: SIGN_OUT_EVENT.UNSENT_BLOCKED });
    expect(
      signOutReducer(asking, { type: SIGN_OUT_EVENT.CONFIRMATION_ANSWERED, leaving: true }),
    ).toEqual({ stage: SIGN_OUT_STAGE.LEAVING });
    expect(
      signOutReducer(asking, { type: SIGN_OUT_EVENT.CONFIRMATION_ANSWERED, leaving: false }),
    ).toEqual(INITIAL_SIGN_OUT_STATE);
  });

  it('ignores a second press, whatever the first one is doing', () => {
    for (const state of [requested(true), requested(false)]) {
      expect(signOutReducer(state, { type: SIGN_OUT_EVENT.REQUESTED, unsent: true })).toBe(state);
      expect(signOutReducer(state, { type: SIGN_OUT_EVENT.REQUESTED, unsent: false })).toBe(state);
    }
  });

  it('ignores an answer about a queue nothing is waiting on', () => {
    const leaving = requested(false);
    expect(signOutReducer(leaving, { type: SIGN_OUT_EVENT.UNSENT_SENT })).toBe(leaving);
    expect(signOutReducer(leaving, { type: SIGN_OUT_EVENT.UNSENT_BLOCKED })).toBe(leaving);
    expect(
      signOutReducer(INITIAL_SIGN_OUT_STATE, { type: SIGN_OUT_EVENT.CONFIRMATION_ANSWERED, leaving: true }),
    ).toBe(INITIAL_SIGN_OUT_STATE);
  });
});

describe('signOutIsAt', () => {
  it('answers for the stage in hand and no other', () => {
    expect(signOutIsAt(requested(true), SIGN_OUT_STAGE.WAITING)).toBe(true);
    expect(signOutIsAt(requested(true), SIGN_OUT_STAGE.LEAVING)).toBe(false);
    expect(signOutIsAt(INITIAL_SIGN_OUT_STATE, SIGN_OUT_STAGE.WAITING)).toBe(false);
  });
});
