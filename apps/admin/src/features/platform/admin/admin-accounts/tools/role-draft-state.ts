import type { ApiFailure, ConsoleRole } from '@easyesg/contracts';

/**
 * The record's role editor (task 67.13): the roles being chosen, and what the last save came to. **One reducer**,
 * because a change to the choice and a submission each clear the last outcome — two writes per event that, as separate
 * `useState`s, would leave a *saved* notice standing over a choice that no longer matches it.
 */
export const ROLE_DRAFT_EVENT = {
  CHOSEN: 'chosen',
  SUBMITTED: 'submitted',
  SAVED: 'saved',
  REFUSED: 'refused',
} as const;

export type RoleDraftEvent =
  | { readonly type: typeof ROLE_DRAFT_EVENT.CHOSEN; readonly roles: readonly ConsoleRole[] }
  | { readonly type: typeof ROLE_DRAFT_EVENT.SUBMITTED }
  | { readonly type: typeof ROLE_DRAFT_EVENT.SAVED }
  | { readonly type: typeof ROLE_DRAFT_EVENT.REFUSED; readonly failure: ApiFailure };

export const ROLE_DRAFT_OUTCOME = {
  SAVED: 'saved',
  REFUSED: 'refused',
} as const;

export type RoleDraftOutcome =
  | { readonly kind: typeof ROLE_DRAFT_OUTCOME.SAVED }
  | { readonly kind: typeof ROLE_DRAFT_OUTCOME.REFUSED; readonly failure: ApiFailure };

export interface RoleDraftState {
  readonly roles: readonly ConsoleRole[];
  readonly outcome: RoleDraftOutcome | null;
}

export const roleDraftReducer = (state: RoleDraftState, event: RoleDraftEvent): RoleDraftState => {
  switch (event.type) {
    case ROLE_DRAFT_EVENT.CHOSEN:
      return { roles: event.roles, outcome: null };
    case ROLE_DRAFT_EVENT.SUBMITTED:
      return { ...state, outcome: null };
    case ROLE_DRAFT_EVENT.SAVED:
      return { ...state, outcome: { kind: ROLE_DRAFT_OUTCOME.SAVED } };
    case ROLE_DRAFT_EVENT.REFUSED:
      return { ...state, outcome: { kind: ROLE_DRAFT_OUTCOME.REFUSED, failure: event.failure } };
  }
};
