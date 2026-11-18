import type { ApiFailure } from '@easyesg/contracts';

/**
 * What A-03's editor can ask of an item (task 67.5), and what the last ask came to — **one value**, since a new ask
 * replaces the last outcome whatever it was: a `useState` over this union, not a flag per action.
 */
export const EDITOR_ACTION = {
  SAVE: 'save',
  SUBMIT: 'submit',
  DISCARD: 'discard',
  REVERT: 'revert',
} as const;

export type EditorAction = (typeof EDITOR_ACTION)[keyof typeof EDITOR_ACTION];

export const EDITOR_OUTCOME = {
  DONE: 'done',
  REFUSED: 'refused',
} as const;

export type EditorOutcome =
  | { readonly kind: typeof EDITOR_OUTCOME.DONE; readonly action: EditorAction }
  | { readonly kind: typeof EDITOR_OUTCOME.REFUSED; readonly failure: ApiFailure };
