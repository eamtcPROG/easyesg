import { UNSUBSCRIBE_STANDING, type UnsubscribeAnswer } from '@easyesg/contracts';

/**
 * S-38's branch (task 52.2.2; FR-169; `design_spec.md` S-38) — which arm the screen draws, from what the api said
 * about the link.
 *
 * Here rather than in the section for S-03's reason: it reaches no API, so every arm — two of the four are error
 * states — is a line of spec rather than a browser journey.
 */
export const UNSUBSCRIBE_VIEW = {
  /** The link can switch the category off: the one arm with an action. */
  CONFIRM: 'confirm',
  /** Already off — from this link before, or from the profile. Nothing to do, and no mistake. */
  SWITCHED_OFF: 'switched_off',
  /** The link can switch nothing off. */
  UNUSABLE: 'unusable',
  /** The read got no answer: not a fact about the link, so the screen says so. */
  UNREACHABLE: 'unreachable',
} as const;

export type UnsubscribeView =
  | {
      readonly kind: typeof UNSUBSCRIBE_VIEW.CONFIRM | typeof UNSUBSCRIBE_VIEW.SWITCHED_OFF;
      /** The category's name as the api resolved it, or `null` where none is written — worded without one. */
      readonly categoryName: string | null;
    }
  | { readonly kind: typeof UNSUBSCRIBE_VIEW.UNUSABLE | typeof UNSUBSCRIBE_VIEW.UNREACHABLE };

/** `null` is the read that got no answer; a problem document is the same fact for this screen. */
export const unsubscribeView = (preview: UnsubscribeAnswer | null): UnsubscribeView => {
  if (preview === null) return { kind: UNSUBSCRIBE_VIEW.UNREACHABLE };
  const categoryName = preview.categoryName ?? null;
  switch (preview.standing) {
    case UNSUBSCRIBE_STANDING.AVAILABLE:
      return { kind: UNSUBSCRIBE_VIEW.CONFIRM, categoryName };
    case UNSUBSCRIBE_STANDING.SWITCHED_OFF:
      return { kind: UNSUBSCRIBE_VIEW.SWITCHED_OFF, categoryName };
    case UNSUBSCRIBE_STANDING.UNUSABLE:
      return { kind: UNSUBSCRIBE_VIEW.UNUSABLE };
  }
};
