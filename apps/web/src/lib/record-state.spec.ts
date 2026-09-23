import { describe, expect, it } from 'vitest';
import { CALLOUT_INTENT } from '@easyesg/ui';
import type { Organization } from '@easyesg/contracts';
import type { Notice } from '@/lib/notice';
import {
  RECORD_EVENT,
  RECORD_REPORT,
  initialRecordState,
  recordReducer,
  visibleNotice,
  type RecordEvent,
  type RecordState,
} from './record-state';

/**
 * A Record screen's transitions (task 129; generic since task 52.3), over S-15's record as the example.
 *
 * **Every branch is asserted on the whole state, not on the field the event names.** That is the
 * point of the reducer over three setters: the defects it exists to prevent are always the field
 * nobody wrote — a stale notice, a record that moved when the save was refused — so a test reading
 * only `notice` after a `REFUSED` would pass with the bug in place.
 */
const record = (name: string): Organization =>
  ({ id: 'org-1', name, countryCode: 'MD', lastChange: null }) as unknown as Organization;

const notice = (intent: Notice['intent']): Notice => ({
  intent,
  title: 'title',
  body: 'body',
  action: null,
});

const SUCCESS = notice(CALLOUT_INTENT.SUCCESS);
const FAILURE = notice(CALLOUT_INTENT.ERROR);

const after = (state: RecordState<Organization>, ...events: readonly RecordEvent<Organization>[]): RecordState<Organization> =>
  events.reduce(recordReducer, state);

describe('recordReducer', () => {
  const start = initialRecordState(record('Brutăria'));

  it('starts with the record it was given and nothing to report', () => {
    expect(start).toStrictEqual({ report: null, record: record('Brutăria') });
  });

  it('clears the previous outcome when the next save starts', () => {
    const settled = after(start, { kind: RECORD_EVENT.REFUSED, notice: FAILURE });
    expect(settled.report).toStrictEqual({ kind: RECORD_REPORT.REFUSED, notice: FAILURE });

    // The defect this branch exists for: a refusal — or a success — framing a request that is still
    // in flight. Asserted on the record too, because "clears the report" must not move anything else.
    expect(after(settled, { kind: RECORD_EVENT.SUBMITTED })).toStrictEqual({
      report: null,
      record: record('Brutăria'),
    });
  });

  it('takes the stored record from the API answer on a save, not from what was typed', () => {
    expect(
      after(start, { kind: RECORD_EVENT.SUBMITTED }, {
        kind: RECORD_EVENT.SAVED,
        stored: record('Brutăria SRL'),
        notice: SUCCESS,
      }),
    ).toStrictEqual({
      report: { kind: RECORD_REPORT.SAVED, notice: SUCCESS },
      record: record('Brutăria SRL'),
    });
  });

  it('moves the stored record to what a refused save had already written (task 52.3)', () => {
    expect(
      after(start, { kind: RECORD_EVENT.SUBMITTED }, {
        kind: RECORD_EVENT.REFUSED,
        notice: FAILURE,
        stored: record('Brutăria SRL'),
      }),
    ).toStrictEqual({
      report: { kind: RECORD_REPORT.REFUSED, notice: FAILURE },
      record: record('Brutăria SRL'),
    });
  });

  it('leaves the stored record untouched when the save is refused', () => {
    // The branch a bare `setCurrent` makes easy to get wrong: nothing was stored, so what a discard
    // restores and what `isDirty` is measured against are still the record we had.
    expect(
      after(start, { kind: RECORD_EVENT.SUBMITTED }, {
        kind: RECORD_EVENT.REFUSED,
        notice: FAILURE,
      }),
    ).toStrictEqual({
      report: { kind: RECORD_REPORT.REFUSED, notice: FAILURE },
      record: record('Brutăria'),
    });
  });

  it('reports nothing after a discard, including a refusal the reader has just undone', () => {
    const refused = after(start, { kind: RECORD_EVENT.REFUSED, notice: FAILURE });

    expect(after(refused, { kind: RECORD_EVENT.DISCARDED })).toStrictEqual({
      report: null,
      record: record('Brutăria'),
    });
  });

  it('keeps the saved record across a later refusal and discard', () => {
    // A journey would have to contrive this: save, then fail, then discard. The record must be the
    // one the API confirmed — not the record the screen opened with.
    const state = after(
      start,
      { kind: RECORD_EVENT.SAVED, stored: record('Brutăria SRL'), notice: SUCCESS },
      { kind: RECORD_EVENT.SUBMITTED },
      { kind: RECORD_EVENT.REFUSED, notice: FAILURE },
      { kind: RECORD_EVENT.DISCARDED },
    );

    expect(state).toStrictEqual({ report: null, record: record('Brutăria SRL') });
  });

  it('leaves a settled report standing until the next submit or discard', () => {
    const saved = after(start, {
      kind: RECORD_EVENT.SAVED,
      stored: record('Brutăria SRL'),
      notice: SUCCESS,
    });

    expect(saved.report).toStrictEqual({ kind: RECORD_REPORT.SAVED, notice: SUCCESS });
  });
});

/**
 * The asymmetry the owner's decision turns on (11 Sep 2026): a **success** is true only while nothing
 * on screen differs from what was stored; a **refusal** stands until the next attempt, because the
 * reader is editing in response to it and clearing the reason mid-correction is the opposite of
 * helpful.
 *
 * Both arms are asserted at both values of `dirty` — which is the whole of the function, and the
 * pair a single "it clears when dirty" case would have left half-tested.
 */
describe('visibleNotice', () => {
  const start = initialRecordState(record('Brutăria'));
  const saved = after(start, {
    kind: RECORD_EVENT.SAVED,
    stored: record('Brutăria SRL'),
    notice: SUCCESS,
  });
  const refused = after(start, { kind: RECORD_EVENT.REFUSED, notice: FAILURE });

  it('shows nothing before anything has settled, dirty or not', () => {
    expect(visibleNotice(start, false)).toBeNull();
    expect(visibleNotice(start, true)).toBeNull();
  });

  it('shows a success only while the record on screen is the one that was saved', () => {
    expect(visibleNotice(saved, false)).toBe(SUCCESS);
    // The defect this closes: "your changes were saved" at the head of a record whose foot says
    // "unsaved changes".
    expect(visibleNotice(saved, true)).toBeNull();
  });

  it('keeps a refusal on screen while the reader edits in response to it', () => {
    expect(visibleNotice(refused, false)).toBe(FAILURE);
    expect(visibleNotice(refused, true)).toBe(FAILURE);
  });

  it('shows the success again once every edit is undone, because the sentence is true again', () => {
    // A stated consequence rather than an oversight: the notice says *the record on screen is what
    // was saved*, and a full revert makes that true. Pinned so a one-way dismissal is a deliberate
    // change rather than a silent one.
    expect(visibleNotice(saved, true)).toBeNull();
    expect(visibleNotice(saved, false)).toBe(SUCCESS);
  });
});
