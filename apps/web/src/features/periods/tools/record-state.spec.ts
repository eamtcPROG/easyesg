import { describe, expect, it } from 'vitest';
import { CALLOUT_INTENT } from '@easyesg/ui';
import {
  INITIAL_PERIOD_RECORD_STATE,
  PERIOD_DIALOGUE,
  PERIOD_RECORD_EVENT,
  PERIOD_REPORT,
  periodRecordReducer,
  periodValueDiffers,
  visibleNotice,
  type PeriodRecordState,
} from './record-state';

/**
 * S-14's Record transitions (task 32.1.2) — every one of these is a state a browser journey can
 * only reach by contriving the timing, which is what the reducer rule says a pure module buys.
 */
const SAVED = {
  kind: PERIOD_REPORT.SAVED,
  notice: { intent: CALLOUT_INTENT.SUCCESS, title: 'Saved', body: 'Recorded.', action: null },
  fields: [],
};
const FAILED = {
  kind: PERIOD_REPORT.REFUSED,
  notice: { intent: CALLOUT_INTENT.ERROR, title: 'Refused', body: 'Locked.', action: null },
  fields: [],
};

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
      report: SAVED,
    });
    expect(settled.report).toEqual(SAVED);

    expect(after(settled, { type: PERIOD_RECORD_EVENT.SUBMITTED })).toEqual({
      pending: true,
      dialogue: null,
      report: null,
      leaving: null,
      checked: false,
    });
  });

  /** 30 Sep 2026: a save pressed with something missing says which fields, and takes the last answer's notice away. */
  it('marks the form checked on a save refused here, and clears the notice above it', () => {
    const refused = after(INITIAL_PERIOD_RECORD_STATE, { type: PERIOD_RECORD_EVENT.SETTLED, report: FAILED });
    const checked = after(refused, { type: PERIOD_RECORD_EVENT.INCOMPLETE });

    expect(checked).toEqual({ ...INITIAL_PERIOD_RECORD_STATE, checked: true });
    // An answer later leaves the check standing: the fields' messages derive from the values, not from this flag alone.
    expect(after(checked, { type: PERIOD_RECORD_EVENT.SUBMITTED }, { type: PERIOD_RECORD_EVENT.SETTLED, report: SAVED }).checked).toBe(true);
  });

  /** 30 Sep 2026: S-13's question before leaving unsaved changes, taken by S-14's record. */
  it('holds where the reader asked to go until they stay or leave, and touches nothing else', () => {
    const refused = after(INITIAL_PERIOD_RECORD_STATE, { type: PERIOD_RECORD_EVENT.SETTLED, report: FAILED });
    const asking = after(refused, { type: PERIOD_RECORD_EVENT.LEAVE_REQUESTED, href: '/entities/e1/periods' });

    expect(asking).toEqual({ ...refused, leaving: '/entities/e1/periods' });
    expect(after(asking, { type: PERIOD_RECORD_EVENT.LEAVE_DISMISSED })).toEqual(refused);
    expect(after(asking, { type: PERIOD_RECORD_EVENT.LEAVE_CONFIRMED })).toEqual(refused);
  });

  it('leaves an open question standing when a write settles — the question is the reader’s, not the write’s', () => {
    const asking = after(
      INITIAL_PERIOD_RECORD_STATE,
      { type: PERIOD_RECORD_EVENT.SUBMITTED },
      { type: PERIOD_RECORD_EVENT.LEAVE_REQUESTED, href: '/entities/e1' },
      { type: PERIOD_RECORD_EVENT.SETTLED, report: SAVED },
    );

    expect(asking.leaving).toBe('/entities/e1');
    expect(asking.pending).toBe(false);
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
      { type: PERIOD_RECORD_EVENT.SETTLED, report: FAILED },
    );

    // A confirmation left open over a rendered refusal invites confirming twice.
    expect(refused.dialogue).toBeNull();
    expect(refused.pending).toBe(false);
    expect(refused.report).toEqual(FAILED);
  });

  /**
   * Opening a confirmation clears a stale notice. Without it the last action's outcome sits above
   * the question about the next one and reads as being about it — the same defect as the first
   * test, one interaction earlier.
   */
  it('clears a stale notice when the next confirmation opens', () => {
    const saved = after(INITIAL_PERIOD_RECORD_STATE, {
      type: PERIOD_RECORD_EVENT.SETTLED,
      report: SAVED,
    });

    const asking = after(saved, {
      type: PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED,
      dialogue: PERIOD_DIALOGUE.REOPEN,
    });

    expect(asking.report).toBeNull();
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

describe('visibleNotice', () => {
  const saved = after(INITIAL_PERIOD_RECORD_STATE, { type: PERIOD_RECORD_EVENT.SETTLED, report: SAVED });
  const refused = after(INITIAL_PERIOD_RECORD_STATE, { type: PERIOD_RECORD_EVENT.SETTLED, report: FAILED });

  it('hides a success the moment the picker differs from what was stored (§8.1)', () => {
    expect(visibleNotice(saved, false)).toBe(SAVED.notice);
    expect(visibleNotice(saved, true)).toBeNull();
  });

  it('keeps a refusal while the reader corrects it', () => {
    expect(visibleNotice(refused, true)).toBe(FAILED.notice);
  });
});

describe('periodValueDiffers', () => {
  const stored = { fiscalYear: '2026', start: '2026-01-01', end: '2026-12-31', due: '' };

  it('sees a change in any of the four fields, and none where they all agree', () => {
    expect(periodValueDiffers({ ...stored }, stored)).toBe(false);
    expect(periodValueDiffers({ ...stored, due: '2027-04-30' }, stored)).toBe(true);
    expect(periodValueDiffers({ ...stored, fiscalYear: '2027' }, stored)).toBe(true);
  });
});
