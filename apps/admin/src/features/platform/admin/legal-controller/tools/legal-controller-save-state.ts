import { API_OUTCOME, PROBLEM_TYPE, type ApiFailure } from '@easyesg/contracts';

/**
 * A-21's save state (task 75) — the write in flight and the notice that follows. **One reducer**, the shape CLAUDE.md
 * names for values one event moves together: a save starting must retire the last notice, which two `useState`s would
 * each have to remember.
 */
export const LEGAL_CONTROLLER_NOTICE = {
  DONE: 'done',
  /** Another operator saved first — §5.2's *error — conflict*, drawn as the values in force with a sentence. */
  CHANGED: 'changed',
  REFUSED: 'refused',
} as const;

export type LegalControllerNotice =
  | { readonly kind: typeof LEGAL_CONTROLLER_NOTICE.DONE }
  | { readonly kind: typeof LEGAL_CONTROLLER_NOTICE.CHANGED }
  | { readonly kind: typeof LEGAL_CONTROLLER_NOTICE.REFUSED; readonly failure: ApiFailure };

export interface LegalControllerSaveState {
  readonly pending: boolean;
  readonly notice: LegalControllerNotice | null;
}

export const INITIAL_LEGAL_CONTROLLER_SAVE_STATE: LegalControllerSaveState = { pending: false, notice: null };

export const LEGAL_CONTROLLER_SAVE_EVENT = {
  STARTED: 'started',
  SUCCEEDED: 'succeeded',
  REFUSED: 'refused',
  NOTICE_DISMISSED: 'notice_dismissed',
} as const;

export type LegalControllerSaveEvent =
  | { readonly type: typeof LEGAL_CONTROLLER_SAVE_EVENT.STARTED }
  | { readonly type: typeof LEGAL_CONTROLLER_SAVE_EVENT.SUCCEEDED }
  | { readonly type: typeof LEGAL_CONTROLLER_SAVE_EVENT.REFUSED; readonly failure: ApiFailure }
  | { readonly type: typeof LEGAL_CONTROLLER_SAVE_EVENT.NOTICE_DISMISSED };

const isChangedMeanwhile = (failure: ApiFailure): boolean =>
  failure.status === API_OUTCOME.Problem && failure.problem.type === PROBLEM_TYPE.LegalControllerChanged;

export function legalControllerSaveReducer(
  state: LegalControllerSaveState,
  event: LegalControllerSaveEvent,
): LegalControllerSaveState {
  switch (event.type) {
    case LEGAL_CONTROLLER_SAVE_EVENT.STARTED:
      // A new save retires the last notice: whatever it said is about to stop being true.
      return { pending: true, notice: null };
    case LEGAL_CONTROLLER_SAVE_EVENT.SUCCEEDED:
      return state.pending ? { pending: false, notice: { kind: LEGAL_CONTROLLER_NOTICE.DONE } } : state;
    case LEGAL_CONTROLLER_SAVE_EVENT.REFUSED:
      if (!state.pending) return state;
      return {
        pending: false,
        notice: isChangedMeanwhile(event.failure)
          ? { kind: LEGAL_CONTROLLER_NOTICE.CHANGED }
          : { kind: LEGAL_CONTROLLER_NOTICE.REFUSED, failure: event.failure },
      };
    case LEGAL_CONTROLLER_SAVE_EVENT.NOTICE_DISMISSED:
      return { ...state, notice: null };
  }
}
