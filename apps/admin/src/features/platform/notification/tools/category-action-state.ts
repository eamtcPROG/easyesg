import {
  API_OUTCOME,
  PROBLEM_TYPE,
  type ApiFailure,
  type CategoryBehaviourRequest,
  type CategoryConsequence,
  type ConsoleCategory,
  type NotificationCategoryKey,
} from '@easyesg/contracts';

/**
 * A-17's publication state (task 67.10) — UX-123's *preview → scope disclosure → confirm → progress → result → revert*
 * as one reducer: the preview in flight, the disclosure awaiting a confirmation, the write in flight, and the notice
 * that follows. **One reducer**, the shape CLAUDE.md names for fields moved by named events: separate `useState`s
 * would leave a stale disclosure open over the next preview, or a notice above the next write.
 *
 * **A revert is previewed exactly as a publication is**, against the behaviour it would restore, so its disclosure
 * says what it does to recipients before anything changes.
 */
export const CATEGORY_CONTROL = {
  PUBLISH: 'publish',
  REVERT: 'revert',
} as const;

export type CategoryControl = (typeof CATEGORY_CONTROL)[keyof typeof CATEGORY_CONTROL];

export interface CategoryAction {
  readonly control: CategoryControl;
  readonly categoryKey: NotificationCategoryKey;
  /** What would be in force afterwards — the proposal, or for a revert the behaviour before. */
  readonly behaviour: CategoryBehaviourRequest;
  /** The revision the record showed; the api refuses the write against any other. */
  readonly expectedRevision: number;
}

/**
 * UX-123's one-step revert for a category as last read: the behaviour before the one in force, against the revision in
 * force — or null where there is nothing to go back to. **One function for the record's control and the result's**, so
 * the two cannot build the revert two ways.
 */
export const revertActionOf = (category: ConsoleCategory): CategoryAction | null => {
  const { inForce } = category;
  if (inForce?.previous == null) return null;
  return {
    control: CATEGORY_CONTROL.REVERT,
    categoryKey: category.categoryKey,
    behaviour: { channels: [...inForce.previous.channels], classification: inForce.previous.classification },
    expectedRevision: inForce.revision,
  };
};

export const CATEGORY_NOTICE = {
  DONE: 'done',
  /** Another operator published first — §5.2's *error — conflict*, drawn as what is in force with a sentence. */
  CHANGED: 'changed',
  REFUSED: 'refused',
} as const;

export type CategoryNotice =
  | { readonly kind: typeof CATEGORY_NOTICE.DONE; readonly action: CategoryAction }
  | { readonly kind: typeof CATEGORY_NOTICE.CHANGED; readonly categoryKey: NotificationCategoryKey }
  | { readonly kind: typeof CATEGORY_NOTICE.REFUSED; readonly failure: ApiFailure };

export interface CategoryActionState {
  /** The action whose preview is being asked for. */
  readonly previewing: CategoryAction | null;
  /** The action awaiting a confirmation, with what the preview disclosed. */
  readonly confirming: { readonly action: CategoryAction; readonly consequences: readonly CategoryConsequence[] } | null;
  /** The action being written. */
  readonly pending: CategoryAction | null;
  readonly notice: CategoryNotice | null;
}

export const INITIAL_CATEGORY_ACTION_STATE: CategoryActionState = {
  previewing: null,
  confirming: null,
  pending: null,
  notice: null,
};

export const CATEGORY_ACTION_EVENT = {
  PREVIEW_STARTED: 'preview_started',
  PREVIEWED: 'previewed',
  CONFIRMATION_CANCELLED: 'confirmation_cancelled',
  STARTED: 'started',
  SUCCEEDED: 'succeeded',
  REFUSED: 'refused',
  NOTICE_DISMISSED: 'notice_dismissed',
} as const;

export type CategoryActionEvent =
  | { readonly type: typeof CATEGORY_ACTION_EVENT.PREVIEW_STARTED; readonly action: CategoryAction }
  | { readonly type: typeof CATEGORY_ACTION_EVENT.PREVIEWED; readonly consequences: readonly CategoryConsequence[] }
  | { readonly type: typeof CATEGORY_ACTION_EVENT.CONFIRMATION_CANCELLED }
  | { readonly type: typeof CATEGORY_ACTION_EVENT.STARTED }
  | { readonly type: typeof CATEGORY_ACTION_EVENT.SUCCEEDED }
  | { readonly type: typeof CATEGORY_ACTION_EVENT.REFUSED; readonly failure: ApiFailure }
  | { readonly type: typeof CATEGORY_ACTION_EVENT.NOTICE_DISMISSED };

/** Whether anything is in flight — a preview, or a write — so no control can start a second one. */
export const isBusy = (state: CategoryActionState): boolean => state.previewing !== null || state.pending !== null;

const isChangedMeanwhile = (failure: ApiFailure): boolean =>
  failure.status === API_OUTCOME.Problem && failure.problem.type === PROBLEM_TYPE.NotificationCategoryChanged;

export function categoryActionReducer(state: CategoryActionState, event: CategoryActionEvent): CategoryActionState {
  switch (event.type) {
    case CATEGORY_ACTION_EVENT.PREVIEW_STARTED:
      // A new proposal retires the last notice: whatever it said is about to stop being true.
      return { previewing: event.action, confirming: null, pending: null, notice: null };
    case CATEGORY_ACTION_EVENT.PREVIEWED:
      return state.previewing === null
        ? state
        : { ...state, previewing: null, confirming: { action: state.previewing, consequences: event.consequences } };
    case CATEGORY_ACTION_EVENT.CONFIRMATION_CANCELLED:
      return { ...state, confirming: null };
    case CATEGORY_ACTION_EVENT.STARTED:
      return state.confirming === null
        ? state
        : { previewing: null, confirming: null, pending: state.confirming.action, notice: null };
    case CATEGORY_ACTION_EVENT.SUCCEEDED:
      return state.pending === null
        ? state
        : { ...state, pending: null, notice: { kind: CATEGORY_NOTICE.DONE, action: state.pending } };
    case CATEGORY_ACTION_EVENT.REFUSED: {
      // A refusal ends whichever step was in flight — the preview's (a rule in code) or the write's (a colleague first).
      const refused = state.pending ?? state.previewing;
      if (refused === null) return state;
      return {
        previewing: null,
        confirming: null,
        pending: null,
        notice: isChangedMeanwhile(event.failure)
          ? { kind: CATEGORY_NOTICE.CHANGED, categoryKey: refused.categoryKey }
          : { kind: CATEGORY_NOTICE.REFUSED, failure: event.failure },
      };
    }
    case CATEGORY_ACTION_EVENT.NOTICE_DISMISSED:
      return { ...state, notice: null };
  }
}
