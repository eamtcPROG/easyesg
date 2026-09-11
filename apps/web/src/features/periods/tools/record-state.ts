import type { ReportingPeriodValue } from '@easyesg/ui';
import type { Notice } from '@/lib/notice';

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
}

export interface PeriodRecordState {
  readonly pending: boolean;
  readonly dialogue: PeriodDialogue | null;
  /** The last settled outcome, or nothing attempted and nothing to report. */
  readonly report: PeriodReport | null;
}

export const INITIAL_PERIOD_RECORD_STATE: PeriodRecordState = {
  pending: false,
  dialogue: null,
  report: null,
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
  SUBMITTED: 'submitted',
  SETTLED: 'settled',
  DIALOGUE_REQUESTED: 'dialogue_requested',
  DISMISSED: 'dismissed',
} as const;

export type PeriodRecordAction =
  | { readonly type: typeof PERIOD_RECORD_EVENT.SUBMITTED }
  | { readonly type: typeof PERIOD_RECORD_EVENT.SETTLED; readonly report: PeriodReport }
  | {
      readonly type: typeof PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED;
      readonly dialogue: PeriodDialogue;
    }
  | { readonly type: typeof PERIOD_RECORD_EVENT.DISMISSED };

export function periodRecordReducer(
  state: PeriodRecordState,
  action: PeriodRecordAction,
): PeriodRecordState {
  switch (action.type) {
    case PERIOD_RECORD_EVENT.SUBMITTED:
      // The previous notice goes now rather than when the answer arrives: a success message sitting
      // above an action in flight tells the reader the wrong thing for as long as the request takes.
      return { ...state, pending: true, report: null };
    case PERIOD_RECORD_EVENT.SETTLED:
      // Whichever dialogue asked closes on the answer, success or refusal — a confirmation left
      // open over a rendered result invites confirming twice.
      return { pending: false, dialogue: null, report: action.report };
    case PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED:
      // Opening a confirmation clears a stale notice too: the reader is asking about the next
      // action, and the last one's outcome above the question reads as being about this one.
      return { ...state, dialogue: action.dialogue, report: null };
    case PERIOD_RECORD_EVENT.DISMISSED:
      return { ...state, dialogue: null };
    default:
      return state;
  }
}
