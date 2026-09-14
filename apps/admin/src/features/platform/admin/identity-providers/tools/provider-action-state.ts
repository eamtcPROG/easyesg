import {
  API_OUTCOME,
  PROBLEM_TYPE,
  type ApiFailure,
  type ConfigureIdentityProviderRequest,
  type SocialProvider,
} from '@easyesg/contracts';

/**
 * A-18's action state (task 67.11) — the confirmation, the write in flight, and the notice that follows. **One
 * reducer**, the shape CLAUDE.md names for three fields moved by named events: separate `useState`s would leave a
 * stale notice above the next write.
 */
export const PROVIDER_CONTROL = {
  SAVE: 'save',
  ENABLE: 'enable',
  DISABLE: 'disable',
} as const;

export type ProviderControl = (typeof PROVIDER_CONTROL)[keyof typeof PROVIDER_CONTROL];

export type ProviderAction =
  | {
      readonly control: typeof PROVIDER_CONTROL.SAVE;
      readonly provider: SocialProvider;
      readonly request: ConfigureIdentityProviderRequest;
    }
  | {
      readonly control: typeof PROVIDER_CONTROL.ENABLE | typeof PROVIDER_CONTROL.DISABLE;
      readonly provider: SocialProvider;
      readonly revision: number;
    };

/**
 * UX-70, over this screen's three writes. **A disable always asks**, because it names what it strands. **A save
 * asks only while the provider is enabled**, because then it changes live sign-in within seconds. **An enable
 * never asks**: it takes nothing from anyone, and the api refuses one that could not sign anyone in.
 */
export const actionAsksConfirmation = (input: {
  readonly action: ProviderAction;
  readonly enabled: boolean;
}): boolean =>
  input.action.control === PROVIDER_CONTROL.DISABLE ||
  (input.action.control === PROVIDER_CONTROL.SAVE && input.enabled);

/**
 * Whether this control is the one in flight for this provider — the busy state a button draws. One predicate for
 * the record's two controls, so the state control and the form cannot ask the question two different ways.
 */
export const isPendingControl = (input: {
  readonly pending: ProviderAction | null;
  readonly provider: SocialProvider;
  readonly control: ProviderControl;
}): boolean =>
  input.pending !== null && input.pending.provider === input.provider && input.pending.control === input.control;

export const PROVIDER_NOTICE = {
  DONE: 'done',
  /** Another operator saved first — §5.2's *error — conflict*, drawn as the values in force with a sentence. */
  CHANGED: 'changed',
  REFUSED: 'refused',
} as const;

export type ProviderNotice =
  | { readonly kind: typeof PROVIDER_NOTICE.DONE; readonly action: ProviderAction }
  | { readonly kind: typeof PROVIDER_NOTICE.CHANGED; readonly provider: SocialProvider }
  | { readonly kind: typeof PROVIDER_NOTICE.REFUSED; readonly action: ProviderAction; readonly failure: ApiFailure };

export interface ProviderActionState {
  readonly confirming: ProviderAction | null;
  readonly pending: ProviderAction | null;
  readonly notice: ProviderNotice | null;
}

export const INITIAL_PROVIDER_ACTION_STATE: ProviderActionState = {
  confirming: null,
  pending: null,
  notice: null,
};

export const PROVIDER_ACTION_EVENT = {
  CONFIRMATION_REQUESTED: 'confirmation_requested',
  CONFIRMATION_CANCELLED: 'confirmation_cancelled',
  STARTED: 'started',
  SUCCEEDED: 'succeeded',
  REFUSED: 'refused',
  NOTICE_DISMISSED: 'notice_dismissed',
} as const;

export type ProviderActionEvent =
  | { readonly type: typeof PROVIDER_ACTION_EVENT.CONFIRMATION_REQUESTED; readonly action: ProviderAction }
  | { readonly type: typeof PROVIDER_ACTION_EVENT.CONFIRMATION_CANCELLED }
  | { readonly type: typeof PROVIDER_ACTION_EVENT.STARTED; readonly action: ProviderAction }
  | { readonly type: typeof PROVIDER_ACTION_EVENT.SUCCEEDED }
  | { readonly type: typeof PROVIDER_ACTION_EVENT.REFUSED; readonly failure: ApiFailure }
  | { readonly type: typeof PROVIDER_ACTION_EVENT.NOTICE_DISMISSED };

const isChangedMeanwhile = (failure: ApiFailure): boolean =>
  failure.status === API_OUTCOME.Problem && failure.problem.type === PROBLEM_TYPE.IdentityProviderChanged;

export function providerActionReducer(state: ProviderActionState, event: ProviderActionEvent): ProviderActionState {
  switch (event.type) {
    case PROVIDER_ACTION_EVENT.CONFIRMATION_REQUESTED:
      return { ...state, confirming: event.action };
    case PROVIDER_ACTION_EVENT.CONFIRMATION_CANCELLED:
      return { ...state, confirming: null };
    case PROVIDER_ACTION_EVENT.STARTED:
      // A new write retires the last notice: whatever it said is about to stop being true.
      return { confirming: null, pending: event.action, notice: null };
    case PROVIDER_ACTION_EVENT.SUCCEEDED:
      return state.pending === null
        ? state
        : { confirming: null, pending: null, notice: { kind: PROVIDER_NOTICE.DONE, action: state.pending } };
    case PROVIDER_ACTION_EVENT.REFUSED:
      if (state.pending === null) return state;
      return {
        confirming: null,
        pending: null,
        notice: isChangedMeanwhile(event.failure)
          ? { kind: PROVIDER_NOTICE.CHANGED, provider: state.pending.provider }
          : { kind: PROVIDER_NOTICE.REFUSED, action: state.pending, failure: event.failure },
      };
    case PROVIDER_ACTION_EVENT.NOTICE_DISMISSED:
      return { ...state, notice: null };
  }
}
