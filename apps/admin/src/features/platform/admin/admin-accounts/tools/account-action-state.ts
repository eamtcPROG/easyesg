import type { ApiFailure } from '@easyesg/contracts';
import type { AccountControl } from './account-controls';

/**
 * A-08's action state (task 67.4) — the record's confirmation, the action in flight, and the notice
 * that follows. **One reducer**, the S-16 shape CLAUDE.md names: three fields moved by named events,
 * where separate `useState`s would leave a stale notice above the next action in flight — the defect
 * that rule was written from.
 */
export interface AccountAction {
  readonly rowId: string;
  readonly control: AccountControl;
  /** The row's address, named in the notice and the dialogue. */
  readonly email: string;
}

export const ACCOUNT_NOTICE = {
  DONE: 'done',
  REFUSED: 'refused',
  INVITED: 'invited',
} as const;

export type AccountNotice =
  | { readonly kind: typeof ACCOUNT_NOTICE.DONE; readonly action: AccountAction }
  | { readonly kind: typeof ACCOUNT_NOTICE.REFUSED; readonly action: AccountAction; readonly failure: ApiFailure }
  | { readonly kind: typeof ACCOUNT_NOTICE.INVITED; readonly email: string };

export interface AccountActionState {
  /** A consequence-disclosing control awaiting its answer (UX-70). */
  readonly confirming: AccountAction | null;
  readonly pending: AccountAction | null;
  readonly notice: AccountNotice | null;
}

export const INITIAL_ACCOUNT_ACTION_STATE: AccountActionState = {
  confirming: null,
  pending: null,
  notice: null,
};

export const ACCOUNT_ACTION_EVENT = {
  CONFIRMATION_REQUESTED: 'confirmation_requested',
  CONFIRMATION_CANCELLED: 'confirmation_cancelled',
  STARTED: 'started',
  SUCCEEDED: 'succeeded',
  REFUSED: 'refused',
  INVITATION_SENT: 'invitation_sent',
  NOTICE_DISMISSED: 'notice_dismissed',
} as const;

export type AccountActionEvent =
  | { readonly type: typeof ACCOUNT_ACTION_EVENT.CONFIRMATION_REQUESTED; readonly action: AccountAction }
  | { readonly type: typeof ACCOUNT_ACTION_EVENT.CONFIRMATION_CANCELLED }
  | { readonly type: typeof ACCOUNT_ACTION_EVENT.STARTED; readonly action: AccountAction }
  | { readonly type: typeof ACCOUNT_ACTION_EVENT.SUCCEEDED }
  | { readonly type: typeof ACCOUNT_ACTION_EVENT.REFUSED; readonly failure: ApiFailure }
  | { readonly type: typeof ACCOUNT_ACTION_EVENT.INVITATION_SENT; readonly email: string }
  | { readonly type: typeof ACCOUNT_ACTION_EVENT.NOTICE_DISMISSED };

export function accountActionReducer(
  state: AccountActionState,
  event: AccountActionEvent,
): AccountActionState {
  switch (event.type) {
    case ACCOUNT_ACTION_EVENT.CONFIRMATION_REQUESTED:
      // Asking about the next action retires the last one's notice: it described a different row.
      return { confirming: event.action, pending: null, notice: null };

    case ACCOUNT_ACTION_EVENT.CONFIRMATION_CANCELLED:
      return { ...state, confirming: null };

    case ACCOUNT_ACTION_EVENT.STARTED:
      // The dialogue stays open while its action runs — `ConsequenceDialogue` drops a close while
      // busy — and the last notice goes, so no result sits above an action still in flight.
      return { confirming: state.confirming, pending: event.action, notice: null };

    case ACCOUNT_ACTION_EVENT.SUCCEEDED:
      return state.pending === null
        ? state
        : { confirming: null, pending: null, notice: { kind: ACCOUNT_NOTICE.DONE, action: state.pending } };

    case ACCOUNT_ACTION_EVENT.REFUSED:
      return state.pending === null
        ? state
        : {
            confirming: null,
            pending: null,
            notice: { kind: ACCOUNT_NOTICE.REFUSED, action: state.pending, failure: event.failure },
          };

    case ACCOUNT_ACTION_EVENT.INVITATION_SENT:
      return { confirming: null, pending: null, notice: { kind: ACCOUNT_NOTICE.INVITED, email: event.email } };

    case ACCOUNT_ACTION_EVENT.NOTICE_DISMISSED:
      return { ...state, notice: null };
  }
}
