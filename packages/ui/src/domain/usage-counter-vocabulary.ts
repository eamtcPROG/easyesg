/**
 * The usage counter's standing (§6.10, UX-52; task 142).
 *
 * **A vocabulary in a module with no `'use client'`**, which is this package's rule for every
 * vocabulary rather than a reaction to this component: `usage-counter.tsx` carries no directive today,
 * and a vocabulary declared inside it would become a client reference — `undefined` on the server —
 * the day it gains one. `primitives/button-vocabulary.ts` carries the account of what that cost.
 */
export const USAGE_STANDING = {
  /** Room remains. The figure is stated and nothing is asked of the reader. */
  WITHIN: 'within',
  /** UX-52: the limit is close — the warning shown against the counter *before* it is reached. */
  APPROACHING: 'approaching',
  /** Nothing remains. The counter says so; the entitlement gate beside it is what refuses. */
  REACHED: 'reached',
  /** The figure cannot be shown — §8.1's partial state, for the one value that did not resolve. */
  UNKNOWN: 'unknown',
} as const;

export type UsageStanding = (typeof USAGE_STANDING)[keyof typeof USAGE_STANDING];
