/**
 * The positions a link is marked with: `page` for a destination, `step` for a place in an ordered progression
 * (task 106), and since task 227 `location` for the part of a page the reader is reading — S-33's *On this page*.
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
  LOCATION: 'location',
} as const;

export type AriaCurrent = (typeof ARIA_CURRENT)[keyof typeof ARIA_CURRENT];
