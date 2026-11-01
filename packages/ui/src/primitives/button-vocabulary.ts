/**
 * Button's closed vocabularies — §11.5's four variants, and the surface a button stands on.
 *
 * **This module exists because `button.tsx` carries `'use client'`, and a plain value exported from a
 * client module is not a value on the server.** The directive marks the whole module as a client
 * boundary: the bundler replaces every export with a client reference, and only the ones React
 * knows how to render — components — survive the crossing. An `as const` object read from a Server
 * Component comes back `undefined`, and a member off it is `undefined` again rather than a throw.
 *
 * Found 4 Sep 2026 by task 74.1's `PublicHeader`, the first Server Component in this repository to
 * read one of these: `tone={BUTTON_TONE.BAND}` passed `undefined`, `.filter(Boolean)` dropped the
 * class, and the button rendered in the wrong colours with nothing in any log — on both sides of
 * the boundary, and past every gate. Every vocabulary in a `'use client'` module was moved out in
 * the same change, because three of the four were not yet reached and would each have failed the
 * same silent way.
 *
 * A vocabulary is data, not behaviour, so it belongs in a module with no directive — importable
 * from both sides. The component imports it back for its own use; the barrel exports it from here.
 *
 * **Do not fold these declarations back into the component.** They read as though they belong
 * there, which is the whole reason this paragraph exists.
 */
/**
 * The four variants, as an `as const` object with the union derived (CLAUDE.md, "Conventions").
 * Deriving changes no caller — `variant="primary"` still compiles — and it gives the set a
 * runtime value, which is what a specimen page needs to render every variant without a second
 * hand-written list going stale beside this one.
 */
export const BUTTON_VARIANT = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  SUBTLE: 'subtle',
  DESTRUCTIVE: 'destructive',
} as const;

export type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

/**
 * The surface a button is standing on, as an `as const` object with the union derived.
 *
 * **Not a fifth variant, and not a colour prop.** The four variants say what the action *is*;
 * this says what is *behind* it. They are orthogonal, which is why a `variant="primary"` on the
 * band is still the screen's primary action — it is drawn inverted because `--accent` is
 * `--pine-600` and the band is `--pine-800`, a pairing of about 1.4:1 that no amount of the
 * ordinary treatment can rescue.
 *
 * **`LanguageSwitcher`'s `SWITCHER_TONE` is the precedent, deliberately followed** — same word,
 * same two members, same reason ("`header` renders on the dark Focus header"). A second name for
 * one concept is how a design system acquires two ways to say the same thing.
 *
 * **It pairs `primary` and nothing else, because `primary` is all that has a consumer.** The
 * prototype draws a white *outlined* mate beside it in the hero and the closing call to action,
 * which are S-29's (task 74.3); `subtle` and `destructive` have no instance on a band at all. A
 * pairing shipped ahead of its screen is a colour nobody has looked at on a real surface, and the
 * three variants left alone here fall back to their ordinary treatment rather than to a guess.
 */
export const BUTTON_TONE = { DEFAULT: 'default', BAND: 'band' } as const;

export type ButtonTone = (typeof BUTTON_TONE)[keyof typeof BUTTON_TONE];
