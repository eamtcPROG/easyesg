/**
 * Whether the tab is on screen (task 149) — the one question OQ-36's *every poll stops while the tab is hidden* asks,
 * and the one AD-15's socket asks to decide whether it is wanted. Declared once, so the poll and the socket cannot
 * disagree about what "hidden" means; TanStack Query's own polls ask the same of `document` through its focus manager.
 */
const VISIBILITY = {
  VISIBLE: 'visible',
} as const satisfies Record<string, DocumentVisibilityState>;

export const tabIsVisible = (): boolean => document.visibilityState === VISIBILITY.VISIBLE;
