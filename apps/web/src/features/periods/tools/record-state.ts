import type { ReportingPeriodValue } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';
import type { RequiredField } from './period-fields';

/**
 * S-14's Record screen state (task 32.1.2).
 *
 * **A reducer rather than four `useState`s**, per the root rule whose tell is mechanical: one event
 * here writes several of these at once. Submitting clears the notice *and* sets pending; a settled
 * action writes the notice, clears pending *and* closes whichever dialogue was open. Written as
 * separate setters, nothing would ever have to say what the fields it did not write should be —
 * which is how S-16 kept a success notice on screen above the next action in flight.
 *
 * It lives in its own module because a pure function makes every transition a unit spec, including
 * the ones a browser journey can only reach by contriving the timing.
 */

/** Which irreversible-class action is being confirmed. UX-71 makes both of them ask first. */
export const PERIOD_DIALOGUE = { LOCK: 'lock', REOPEN: 'reopen' } as const;

export type PeriodDialogue = (typeof PERIOD_DIALOGUE)[keyof typeof PERIOD_DIALOGUE];

/**
 * What the screen is saying — the app's shared `Notice`, built by `noticeFromOutcome`.
 *
 * **Not a private union of "saved" and "failed"**: three screens had already grown their own copy
 * of the outcome-to-notice translation and two had drifted, which is why `lib/notice.ts` exists. A
 * fourth copy here would skip the per-member RFC 9457 repair, so a refusal whose problem document
 * omits `title` or `detail` would render this screen's fallback where the API's own three-part text
 * belongs.
 */
export type PeriodNotice = Notice;

/**
 * Which side settled — two members rather than a boolean, because they differ in **how long they
 * stay true** (`design_spec.md` §8.1's Success row; task 134, applying the S-15 decision here): a
 * success is true only while nothing on screen differs from what was stored, a refusal until the
 * next attempt.
 */
export const PERIOD_REPORT = { SAVED: 'saved', REFUSED: 'refused' } as const;

export type PeriodReportKind = (typeof PERIOD_REPORT)[keyof typeof PERIOD_REPORT];

export interface PeriodReport {
  readonly kind: PeriodReportKind;
  readonly notice: PeriodNotice;
  /** The fields a refusal names (`refusedFields`) — marked on the form beside the sentence above it. Empty otherwise. */
  readonly fields: readonly RequiredField[];
}

export interface PeriodRecordState {
  readonly pending: boolean;
  readonly dialogue: PeriodDialogue | null;
  /** The last settled outcome, or nothing attempted and nothing to report. */
  readonly report: PeriodReport | null;
  /**
   * Where the reader asked to go with changes unsaved — the arrow's or a breadcrumb step's address (30 Sep 2026, S-13's
   * question taken by S-14). The question is open while this is set, and *leave* goes there. The address rather than a
   * flag, so the answer cannot go somewhere else.
   */
  readonly leaving: string | null;
  /**
   * A save was pressed with something missing (30 Sep 2026, project owner: the form said nothing about which field was
   * wrong). From then on each missing field says so and the summary lists them; the messages themselves are derived
   * from the values, so filling a field clears its own.
   */
  readonly checked: boolean;
}

export const INITIAL_PERIOD_RECORD_STATE: PeriodRecordState = {
  pending: false,
  dialogue: null,
  report: null,
  leaving: null,
  checked: false,
};

/** Whether the picker's value differs from the stored period's — the half of "dirty" this record has. */
export const periodValueDiffers = (
  value: ReportingPeriodValue,
  stored: ReportingPeriodValue,
): boolean =>
  value.fiscalYear !== stored.fiscalYear ||
  value.start !== stored.start ||
  value.end !== stored.end ||
  value.due !== stored.due;

/** What the screen should actually show: a success only while nothing differs, a refusal until the next attempt. */
export const visibleNotice = (state: PeriodRecordState, dirty: boolean): PeriodNotice | null => {
  if (state.report === null) return null;
  if (state.report.kind === PERIOD_REPORT.SAVED && dirty) return null;
  return state.report.notice;
};

/**
 * Events named for **what happened**, never for the field they write — `SETTLED`, not `SET_NOTICE`.
 * A setter-shaped action is the `useState`s again in a reducer's clothes, re-scattering the decision
 * this gathers.
 */
export const PERIOD_RECORD_EVENT = {
  /** A save was pressed and refused here, before any request, because something is missing or out of order. */
  INCOMPLETE: 'incomplete',
  SUBMITTED: 'submitted',
  SETTLED: 'settled',
  DIALOGUE_REQUESTED: 'dialogue_requested',
  DISMISSED: 'dismissed',
  /** The reader followed a way out with changes unsaved; the question opens. */
  LEAVE_REQUESTED: 'leave_requested',
  /** The reader chose to stay. */
  LEAVE_DISMISSED: 'leave_dismissed',
  /** The reader chose to leave without saving; the page is changing. */
  LEAVE_CONFIRMED: 'leave_confirmed',
} as const;

export type PeriodRecordAction =
  | { readonly type: typeof PERIOD_RECORD_EVENT.INCOMPLETE }
  | { readonly type: typeof PERIOD_RECORD_EVENT.SUBMITTED }
  | { readonly type: typeof PERIOD_RECORD_EVENT.SETTLED; readonly report: PeriodReport }
  | {
      readonly type: typeof PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED;
      readonly dialogue: PeriodDialogue;
    }
  | { readonly type: typeof PERIOD_RECORD_EVENT.DISMISSED }
  | { readonly type: typeof PERIOD_RECORD_EVENT.LEAVE_REQUESTED; readonly href: string }
  | { readonly type: typeof PERIOD_RECORD_EVENT.LEAVE_DISMISSED }
  | { readonly type: typeof PERIOD_RECORD_EVENT.LEAVE_CONFIRMED };

export function periodRecordReducer(
  state: PeriodRecordState,
  action: PeriodRecordAction,
): PeriodRecordState {
  switch (action.type) {
    case PERIOD_RECORD_EVENT.INCOMPLETE:
      // The fields say what is wrong now, so the last answer's notice goes as a submit's does.
      return { ...state, checked: true, report: null };
    case PERIOD_RECORD_EVENT.SUBMITTED:
      // The previous notice goes now rather than when the answer arrives: a success message sitting
      // above an action in flight tells the reader the wrong thing for as long as the request takes.
      return { ...state, pending: true, report: null };
    case PERIOD_RECORD_EVENT.SETTLED:
      // Whichever dialogue asked closes on the answer, success or refusal — a confirmation left
      // open over a rendered result invites confirming twice. A leave question is the reader's,
      // not the write's, so the answer leaves it as it was.
      return { ...state, pending: false, dialogue: null, report: action.report };
    case PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED:
      // Opening a confirmation clears a stale notice too: the reader is asking about the next
      // action, and the last one's outcome above the question reads as being about this one.
      return { ...state, dialogue: action.dialogue, report: null };
    case PERIOD_RECORD_EVENT.DISMISSED:
      return { ...state, dialogue: null };
    case PERIOD_RECORD_EVENT.LEAVE_REQUESTED:
      return { ...state, leaving: action.href };
    // Staying and leaving both close the question; they differ in what the form does next, not in what it holds.
    case PERIOD_RECORD_EVENT.LEAVE_DISMISSED:
    case PERIOD_RECORD_EVENT.LEAVE_CONFIRMED:
      return { ...state, leaving: null };
    default:
      return state;
  }
}
