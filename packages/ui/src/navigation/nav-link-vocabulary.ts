/**
 * The two positions this package marks on a link: `page` for a destination, `step` for a place in
 * an ordered progression (task 106).
 *
 * **A sibling module, not an `as const` at the top of `nav-link.tsx`**, which is this package's
 * standing rule for a vocabulary — the four before it are here for the same reason. `nav-link.tsx`
 * carries no `'use client'` today, so nothing breaks either way; the point is that it exports a
 * component and the day someone adds the directive, a vocabulary living beside it would reach a
 * Server Component as `undefined` with every gate green. The root file records what that cost.
 */
export const ARIA_CURRENT = {
  PAGE: 'page',
  STEP: 'step',
} as const;

export type AriaCurrent = (typeof ARIA_CURRENT)[keyof typeof ARIA_CURRENT];
