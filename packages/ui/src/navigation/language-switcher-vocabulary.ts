/**
 * The two surfaces the language switcher sits on.
 *
 * **A vocabulary in a module with no `'use client'`, and that is the whole point of the file.**
 * `language-switcher.tsx` is a client module, so every export it carries becomes a client reference — an
 * `as const` object read from a Server Component is `undefined`, silently, on both sides of the
 * boundary. `primitives/button-vocabulary.ts` carries the full account and the defect that found
 * it. This one had no server reader yet; it would have failed the same way on the first.
 */
/**
 * The two surfaces this switcher sits on, as an `as const` object with the union derived
 * (CLAUDE.md, "Conventions"). Deriving changes no caller — `tone="header"` still compiles.
 */
export const SWITCHER_TONE = { DEFAULT: 'default', HEADER: 'header' } as const;

export type SwitcherTone = (typeof SWITCHER_TONE)[keyof typeof SWITCHER_TONE];
