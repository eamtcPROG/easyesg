import type { Organization } from '@easyesg/contracts';
import type { Notice } from '@/lib/notice';

/**
 * S-15's screen state, as one value and the events that move it (task 129).
 *
 * **Three `useState`s became one reducer because they were never three states.** The form held
 * `failure`, `saved` and `current` separately, and **every handler wrote two or three of them** —
 * which is the tell `apps/web`'s rule states mechanically: *two different setters called in one
 * handler*. Submitting wrote `setFailure(null)` and `setSaved(false)`; discarding wrote the same
 * pair; a successful save wrote `setCurrent`, `setSaved` and a `reset`. Scattered like that, the
 * question *what should the fields I did not write become?* is never asked.
 *
 * **`saved` and `failure` were also mutually exclusive and separately representable**, so
 * `{ saved: true, failure: <problem> }` was a state the types allowed and nothing produced —
 * the impossible pair the rule says to make unrepresentable. One `notice` holds either, through
 * `@/lib/notice`, which is the second half of this task: the form spelled out
 * *title from `problem.title` or a fallback, body from `problem.detail` or a fallback* in JSX, and
 * that rule already exists in one place because S-16 and S-28 had drifted two copies of it.
 *
 * **Writing the whole next state surfaced a contradiction, and the owner closed it.** A success
 * notice used to survive subsequent edits: save, then type, and *"your changes were saved"* sat at
 * the head of the record while the foot read *"unsaved changes"*. Raised as a UX decision rather
 * than taken as a refactor's, and decided (project owner, 11 Sep 2026): it clears.
 *
 * **The two reports are not symmetrical, which is why `kind` is in the state rather than read off
 * the `intent`.** A refusal **stands until the next attempt**, edits included — the reader is
 * editing *because* it was refused, and clearing the reason mid-correction is the opposite of
 * helpful. A success is true only while nothing differs from what was stored. Inferring that from
 * `CALLOUT_INTENT.SUCCESS` would make a presentational value load-bearing, and the two would part
 * company the first time a success needed a different intent.
 *
 * **Derived during render, never cleared by an effect** (`rerender-derived-state-no-effect`).
 * `visibleNotice` below is a pure function of the state and one boolean, so it is a unit spec like
 * every transition here — and there is no event to dispatch on a keystroke, no subscription, and
 * nothing that can fall out of step with what react-hook-form believes.
 *
 * **A consequence worth stating: the notice comes back if the reader undoes every edit.** That reads
 * odd until the sentence is read precisely — it says *the record on screen is what was saved*, and
 * after a full revert that is true again. The alternative is a one-way dismissal, which needs an
 * event on every keystroke and a second place that can disagree with `isDirty`.
 *
 * **`record` is what is STORED, never what is typed.** react-hook-form owns the typed values and
 * computes `isDirty` against `defaultValues`; this is the record those defaults are re-seeded from
 * after a save, and the one a discard restores. A refusal leaves it exactly as it was, which is the
 * branch that would have been easiest to get wrong with a bare `setCurrent`.
 *
 * **Pure, and in its own module**, for the reason `access-state.ts` is: a reducer is a function from
 * state and event to state, so its transitions are a unit spec rather than a browser journey —
 * including the ones a journey cannot reach without contriving the timing.
 */
export const PROFILE_EVENT = {
  /** A save left for the API. */
  SUBMITTED: 'submitted',
  /** The API stored it and answered with the canonical record. */
  SAVED: 'saved',
  /** The API refused, or never answered. */
  REFUSED: 'refused',
  /** The reader put the form back to the stored record (§5's Controls row). */
  DISCARDED: 'discarded',
} as const;

export type ProfileEventKind = (typeof PROFILE_EVENT)[keyof typeof PROFILE_EVENT];

/**
 * Named for **what happened**, never for the field it writes — a `SET_NOTICE` action type would be
 * the three `useState`s wearing a reducer's clothes and would re-scatter the decision this gathers.
 */
export type ProfileEvent =
  | { readonly kind: typeof PROFILE_EVENT.SUBMITTED }
  | { readonly kind: typeof PROFILE_EVENT.SAVED; readonly stored: Organization; readonly notice: Notice }
  | { readonly kind: typeof PROFILE_EVENT.REFUSED; readonly notice: Notice }
  | { readonly kind: typeof PROFILE_EVENT.DISCARDED };

/**
 * Which side settled. Two members rather than a boolean, because they differ in **how long they
 * stay true** and a boolean named `ok` would say nothing about that.
 */
export const PROFILE_REPORT = {
  /** The API stored it. True only while nothing on screen differs from what it stored. */
  SAVED: 'saved',
  /** The API refused, or never answered. True until the next attempt, edits included. */
  REFUSED: 'refused',
} as const;

export type ProfileReportKind = (typeof PROFILE_REPORT)[keyof typeof PROFILE_REPORT];

export interface ProfileReport {
  readonly kind: ProfileReportKind;
  readonly notice: Notice;
}

export interface ProfileState {
  /** The last settled outcome, or nothing attempted and nothing to report. */
  readonly report: ProfileReport | null;
  /** The record as the API last confirmed it — what `isDirty` and a discard are measured against. */
  readonly record: Organization;
}

export const initialProfileState = (organization: Organization): ProfileState => ({
  report: null,
  record: organization,
});

/**
 * What the screen should actually show, from the state and whether a field differs.
 *
 * **A `boolean` beside a `ProfileState` rather than two booleans**, so the root file's ban on
 * adjacent same-typed parameters does not bite — nothing here can be confused with the clock or with
 * the other argument.
 *
 * The whole asymmetry lives in one expression: a refusal survives editing, a success does not.
 */
export const visibleNotice = (state: ProfileState, dirty: boolean): Notice | null => {
  if (state.report === null) return null;
  if (state.report.kind === PROFILE_REPORT.SAVED && dirty) return null;
  return state.report.notice;
};

export function profileReducer(state: ProfileState, event: ProfileEvent): ProfileState {
  switch (event.kind) {
    // The previous outcome goes before the next save starts, so a stale success cannot frame a
    // request that is still running — the defect `access-state.ts` found by writing this out.
    case PROFILE_EVENT.SUBMITTED:
      return { report: null, record: state.record };

    // The stored record moves to what the API answered, not to what was typed: the API normalises
    // (trimmed name, upper-cased country and LEI) and a form re-seeded from the reader's own text
    // would show a permanently dirty field they cannot clean.
    case PROFILE_EVENT.SAVED:
      return { report: { kind: PROFILE_REPORT.SAVED, notice: event.notice }, record: event.stored };

    // The record does NOT move. A refused save changed nothing on the server, so what a discard
    // restores and what `isDirty` measures against are still the record we had.
    case PROFILE_EVENT.REFUSED:
      return { report: { kind: PROFILE_REPORT.REFUSED, notice: event.notice }, record: state.record };

    // Nothing was attempted, so there is no outcome to report — including a refusal the reader has
    // just undone by restoring the stored values.
    case PROFILE_EVENT.DISCARDED:
      return { report: null, record: state.record };
  }
}
