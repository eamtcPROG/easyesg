import type { Notice } from '@/lib/notice';

/**
 * A Record screen's state, as one value and the events that move it — S-15's since task 129, and S-27's since task 52.3.
 *
 * **In `src/lib/` because two features read it** (`shared-how-many-siblings`): it was S-15's `profile-state.ts`, and S-27
 * is a second Record with the same four events over a different record. Nothing in it knew it was an organization but
 * the record's type, so the record is a type parameter and the transitions — and the argument for them below — are
 * unchanged.
 *
 * **Three `useState`s became one reducer because they were never three states.** S-15's form held `failure`, `saved`
 * and `current` separately, and **every handler wrote two or three of them** — the tell `apps/web`'s rule states
 * mechanically: *two different setters called in one handler*. Scattered like that, the question *what should the
 * fields I did not write become?* is never asked. **`saved` and `failure` were also mutually exclusive and separately
 * representable**, so one `notice` holds either, through `@/lib/notice`.
 *
 * **A success clears once a field differs; a refusal stands until the next attempt** (project owner, 11 Sep 2026;
 * `design_spec.md` §8.1's Success row) — which is why `kind` is in the state rather than read off the `intent`. The
 * reader is editing *because* a save was refused, and clearing the reason mid-correction is the opposite of helpful;
 * a success is true only while nothing differs from what was stored. **Derived during render, never cleared by an
 * effect** (`rerender-derived-state-no-effect`): `visibleNotice` is a pure function of the state and one boolean. A
 * consequence worth stating: the notice comes back if the reader undoes every edit, since *the record on screen is
 * what was saved* is then true again.
 *
 * **`record` is what is STORED, never what is typed.** react-hook-form owns the typed values and computes `isDirty`
 * against `defaultValues`; this is the record those defaults are re-seeded from after a save, and the one a discard
 * restores. A refusal leaves it exactly as it was.
 */
export const RECORD_EVENT = {
  /** A save left for the API. */
  SUBMITTED: 'submitted',
  /** The API stored it and answered with the canonical record. */
  SAVED: 'saved',
  /** The API refused, or never answered. */
  REFUSED: 'refused',
  /** The reader put the form back to the stored record (§5's Controls row). */
  DISCARDED: 'discarded',
} as const;

export type RecordEventKind = (typeof RECORD_EVENT)[keyof typeof RECORD_EVENT];

/**
 * Named for **what happened**, never for the field it writes — a `SET_NOTICE` action type would be
 * the three `useState`s wearing a reducer's clothes and would re-scatter the decision this gathers.
 */
export type RecordEvent<T> =
  | { readonly kind: typeof RECORD_EVENT.SUBMITTED }
  | { readonly kind: typeof RECORD_EVENT.SAVED; readonly stored: T; readonly notice: Notice }
  | {
      readonly kind: typeof RECORD_EVENT.REFUSED;
      readonly notice: Notice;
      /**
       * What the save wrote before it was refused, where it wrote anything — S-27's preferences, written before its
       * profile was refused (task 52.3). Absent, nothing was written and the record stays.
       */
      readonly stored?: T;
    }
  | { readonly kind: typeof RECORD_EVENT.DISCARDED };

/**
 * Which side settled. Two members rather than a boolean, because they differ in **how long they
 * stay true** and a boolean named `ok` would say nothing about that.
 */
export const RECORD_REPORT = {
  /** The API stored it. True only while nothing on screen differs from what it stored. */
  SAVED: 'saved',
  /** The API refused, or never answered. True until the next attempt, edits included. */
  REFUSED: 'refused',
} as const;

export type RecordReportKind = (typeof RECORD_REPORT)[keyof typeof RECORD_REPORT];

export interface RecordReport {
  readonly kind: RecordReportKind;
  readonly notice: Notice;
}

export interface RecordState<T> {
  /** The last settled outcome, or nothing attempted and nothing to report. */
  readonly report: RecordReport | null;
  /** The record as the API last confirmed it — what `isDirty` and a discard are measured against. */
  readonly record: T;
}

export const initialRecordState = <T>(record: T): RecordState<T> => ({
  report: null,
  record,
});

/**
 * What the screen should actually show, from the state and whether a field differs.
 *
 * **A `boolean` beside a `RecordState` rather than two booleans**, so the root file's ban on
 * adjacent same-typed parameters does not bite — nothing here can be confused with the clock or with
 * the other argument.
 *
 * The whole asymmetry lives in one expression: a refusal survives editing, a success does not.
 */
export const visibleNotice = <T>(state: RecordState<T>, dirty: boolean): Notice | null => {
  if (state.report === null) return null;
  if (state.report.kind === RECORD_REPORT.SAVED && dirty) return null;
  return state.report.notice;
};

export function recordReducer<T>(state: RecordState<T>, event: RecordEvent<T>): RecordState<T> {
  switch (event.kind) {
    // The previous outcome goes before the next save starts, so a stale success cannot frame a
    // request that is still running — the defect `access-state.ts` found by writing this out.
    case RECORD_EVENT.SUBMITTED:
      return { report: null, record: state.record };

    // The stored record moves to what the API answered, not to what was typed: the API normalises
    // (S-15's trimmed name and upper-cased LEI, S-27's phone in one spelling) and a form re-seeded from the reader's own text
    // would show a permanently dirty field they cannot clean.
    case RECORD_EVENT.SAVED:
      return { report: { kind: RECORD_REPORT.SAVED, notice: event.notice }, record: event.stored };

    // The record does NOT move. A refused save changed nothing on the server, so what a discard
    // restores and what `isDirty` measures against are still the record we had.
    // A save of two resources can be refused after the first was written (S-27, task 52.3): then the record moves to
    // what was written, so a discard restores what is actually stored, and the refusal is still what the reader sees.
    case RECORD_EVENT.REFUSED:
      return { report: { kind: RECORD_REPORT.REFUSED, notice: event.notice }, record: event.stored ?? state.record };

    // Nothing was attempted, so there is no outcome to report — including a refusal the reader has
    // just undone by restoring the stored values.
    case RECORD_EVENT.DISCARDED:
      return { report: null, record: state.record };
  }
}
