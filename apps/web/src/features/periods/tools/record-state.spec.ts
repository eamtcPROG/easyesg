import { describe, expect, it } from 'vitest';
import { CALLOUT_INTENT } from '@easyesg/ui';
import {
  INITIAL_PERIOD_RECORD_STATE,
  PERIOD_DIALOGUE,
  PERIOD_RECORD_EVENT,
  periodRecordReducer,
  type PeriodRecordState,
} from './record-state';

/**
 * S-14's Record transitions (task 32.1.2) — every one of these is a state a browser journey can
 * only reach by contriving the timing, which is what the reducer rule says a pure module buys.
 */
const SAVED = { intent: CALLOUT_INTENT.SUCCESS, title: 'Saved', body: 'Recorded.', action: null };
const FAILED = { intent: CALLOUT_INTENT.ERROR, title: 'Refused', body: 'Locked.', action: null };

const after = (state: PeriodRecordState, ...actions: Parameters<typeof periodRecordReducer>[1][]) =>
  actions.reduce(periodRecordReducer, state);

describe('periodRecordReducer', () => {
  /**
   * The defect the rule was written from: S-16 kept a success notice on screen while the next
   * action ran, so *"the invitation has been sent"* sat above a removal in flight. One event, two
   * fields — which is exactly what separate setters never ask about.
   */
  it('clears the previous notice when a new action starts', () => {
    const settled = after(INITIAL_PERIOD_RECORD_STATE, {
      type: PERIOD_RECORD_EVENT.SETTLED,
      notice: SAVED,
    });
    expect(settled.notice).toEqual(SAVED);

    expect(after(settled, { type: PERIOD_RECORD_EVENT.SUBMITTED })).toEqual({
      pending: true,
      dialogue: null,
      notice: null,
    });
  });

  it('closes whichever dialogue asked, on a refusal as much as on a success', () => {
    const confirming = after(INITIAL_PERIOD_RECORD_STATE, {
      type: PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED,
      dialogue: PERIOD_DIALOGUE.LOCK,
    });
    expect(confirming.dialogue).toBe(PERIOD_DIALOGUE.LOCK);

    const refused = after(
      confirming,
      { type: PERIOD_RECORD_EVENT.SUBMITTED },
      { type: PERIOD_RECORD_EVENT.SETTLED, notice: FAILED },
    );

    // A confirmation left open over a rendered refusal invites confirming twice.
    expect(refused.dialogue).toBeNull();
    expect(refused.pending).toBe(false);
    expect(refused.notice).toEqual(FAILED);
  });

  /**
   * Opening a confirmation clears a stale notice. Without it the last action's outcome sits above
   * the question about the next one and reads as being about it — the same defect as the first
   * test, one interaction earlier.
   */
  it('clears a stale notice when the next confirmation opens', () => {
    const saved = after(INITIAL_PERIOD_RECORD_STATE, {
      type: PERIOD_RECORD_EVENT.SETTLED,
      notice: SAVED,
    });

    const asking = after(saved, {
      type: PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED,
      dialogue: PERIOD_DIALOGUE.REOPEN,
    });

    expect(asking.notice).toBeNull();
    expect(asking.dialogue).toBe(PERIOD_DIALOGUE.REOPEN);
  });

  it('leaves the notice alone when a dialogue is merely dismissed', () => {
    const asking = after(INITIAL_PERIOD_RECORD_STATE, {
      type: PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED,
      dialogue: PERIOD_DIALOGUE.LOCK,
    });

    // Cancelling is not an outcome, so it must not manufacture one — nor clear pending, which it
    // never set.
    expect(after(asking, { type: PERIOD_RECORD_EVENT.DISMISSED })).toEqual(
      INITIAL_PERIOD_RECORD_STATE,
    );
  });
});
