/**
 * The surfaces the Global bar is drawn as (task 67.1).
 *
 * **A directive-free sibling module**, this package's standing shape for a vocabulary —
 * `primitives/button-vocabulary.ts` carries the account of what a vocabulary inside a client module
 * costs. `global-bar.tsx` has no directive and `account-menu.tsx` does, and both read this, which is
 * the case the rule exists for: an `as const` read across that boundary is `undefined`, silently.
 *
 * **A tone, not a variant and not a second band** — `BUTTON_TONE` and `SWITCHER_TONE` are the
 * precedent, deliberately followed. The anatomy is the band's either way; the tone says which surface
 * it is drawn on (`design_spec.md` §11.5, *Console nav*).
 */
export const GLOBAL_BAR_TONE = {
  /** The brand-dark band of the tenant application and the public site. */
  BRAND: 'brand',
  /** The administrative console's dark neutral band — a separate realm, and it looks it (§5.2). */
  CONSOLE: 'console',
} as const;

export type GlobalBarTone = (typeof GLOBAL_BAR_TONE)[keyof typeof GLOBAL_BAR_TONE];
