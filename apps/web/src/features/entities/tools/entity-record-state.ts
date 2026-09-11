import type { NaceCodeMatch } from '@easyesg/contracts';
import type { Notice } from '@/lib/notice';

/**
 * S-13's record state, as one value and the events that move it (task 134, on S-15's precedent).
 *
 * **Four `useState`s became one reducer because they were never four states.** The form held
 * `failure`, `saved`, `codes` and `confirmingArchive` separately, and every handler wrote two or
 * three of them — submit cleared the first two, discard wrote three and reset the form, an archive
 * refusal closed the dialogue and set the failure. Written out as transitions, the question *what
 * should the fields I did not write become?* is asked once per event.
 *
 * **`saved` and `failure` were mutually exclusive and separately representable**; one `report`
 * holds either, through `@/lib/notice`, so the per-member fallback of a problem document is the
 * rule that module owns rather than a fourth copy spelled in JSX.
 *
 * **The activity codes live here because they live outside the form**: a `useFieldArray` of codes
 * would put the words in form state where nothing edits them, so `isDirty` cannot see them and
 * `codesChanged` is OR'd in. `served` is what the API last confirmed — the list the page handed
 * over, then the list a save sent — and a discard restores it, which is why it is state and not a
 * prop read at the moment of discarding.
 *
 * **A success is true only while nothing differs from what was stored; a refusal stands until the
 * next attempt.** The owner decided that asymmetry for S-15 (11 Sep 2026) and it holds here for
 * the same reason: the reader is editing *because* it was refused. `visibleNotice` is the whole of
 * it, derived during render (`rerender-derived-state-no-effect`).
 */
export const ENTITY_EVENT = {
  /** A save left for the API. */
  SUBMITTED: 'submitted',
  /** The API stored it and answered with the canonical record. */
  SAVED: 'saved',
  /** The API refused a save or an archive, or never answered. */
  REFUSED: 'refused',
  /** The reader put the form and the codes back to what was stored. */
  DISCARDED: 'discarded',
  /** The reader changed the activity list, which the form cannot see. */
  CODES_CHANGED: 'codes_changed',
  /** The reader asked to archive; the consequence dialogue opens. */
  ARCHIVE_REQUESTED: 'archive_requested',
  /** The reader cancelled the dialogue. */
  ARCHIVE_DISMISSED: 'archive_dismissed',
} as const;

export type EntityEventKind = (typeof ENTITY_EVENT)[keyof typeof ENTITY_EVENT];

export type EntityEvent =
  | { readonly kind: typeof ENTITY_EVENT.SUBMITTED }
  | { readonly kind: typeof ENTITY_EVENT.SAVED; readonly notice: Notice }
  | { readonly kind: typeof ENTITY_EVENT.REFUSED; readonly notice: Notice }
  | { readonly kind: typeof ENTITY_EVENT.DISCARDED }
  | { readonly kind: typeof ENTITY_EVENT.CODES_CHANGED; readonly codes: readonly NaceCodeMatch[] }
  | { readonly kind: typeof ENTITY_EVENT.ARCHIVE_REQUESTED }
  | { readonly kind: typeof ENTITY_EVENT.ARCHIVE_DISMISSED };

/** Which side settled — two members rather than a boolean, because they differ in how long they stay true. */
export const ENTITY_REPORT = {
  SAVED: 'saved',
  REFUSED: 'refused',
} as const;

export type EntityReportKind = (typeof ENTITY_REPORT)[keyof typeof ENTITY_REPORT];

export interface EntityReport {
  readonly kind: EntityReportKind;
  readonly notice: Notice;
}

export interface EntityRecordState {
  /** The last settled outcome, or nothing attempted and nothing to report. */
  readonly report: EntityReport | null;
  /** The activity list as the API last confirmed it — what a discard restores. */
  readonly served: readonly NaceCodeMatch[];
  /** The activity list as the reader has it. */
  readonly codes: readonly NaceCodeMatch[];
  readonly confirmingArchive: boolean;
}

export const initialEntityRecordState = (activity: readonly NaceCodeMatch[]): EntityRecordState => ({
  report: null,
  served: activity,
  codes: activity,
  confirmingArchive: false,
});

/** Whether the activity list differs from what was stored — the half of "dirty" the form cannot see. */
export const codesChanged = (state: EntityRecordState): boolean =>
  state.codes.length !== state.served.length ||
  state.codes.some((code, index) => code.code !== state.served[index]?.code);

/**
 * What the screen should actually show, from the state and whether anything differs. A `boolean`
 * beside a state rather than two booleans, so nothing can be confused with the other argument.
 */
export const visibleNotice = (state: EntityRecordState, dirty: boolean): Notice | null => {
  if (state.report === null) return null;
  if (state.report.kind === ENTITY_REPORT.SAVED && dirty) return null;
  return state.report.notice;
};

export function entityRecordReducer(state: EntityRecordState, event: EntityEvent): EntityRecordState {
  switch (event.kind) {
    // The previous outcome goes before the next save starts, so a stale success cannot frame a
    // request that is still running.
    case ENTITY_EVENT.SUBMITTED:
      return { ...state, report: null };

    // What was sent is now what is stored, so the codes stop counting as changed.
    case ENTITY_EVENT.SAVED:
      return { ...state, report: { kind: ENTITY_REPORT.SAVED, notice: event.notice }, served: state.codes };

    // A refusal closes the dialogue whichever action it answered: the reader reads the reason
    // where the form is, not behind a modal that can no longer be confirmed.
    case ENTITY_EVENT.REFUSED:
      return {
        ...state,
        report: { kind: ENTITY_REPORT.REFUSED, notice: event.notice },
        confirmingArchive: false,
      };

    // Nothing attempted and nothing to report; the codes go back to what was stored.
    case ENTITY_EVENT.DISCARDED:
      return { ...state, report: null, codes: state.served };

    case ENTITY_EVENT.CODES_CHANGED:
      return { ...state, codes: event.codes };

    case ENTITY_EVENT.ARCHIVE_REQUESTED:
      return { ...state, confirmingArchive: true };

    case ENTITY_EVENT.ARCHIVE_DISMISSED:
      return { ...state, confirmingArchive: false };
  }
}
