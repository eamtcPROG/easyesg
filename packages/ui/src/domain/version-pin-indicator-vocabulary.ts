/**
 * The version pin's standing (§6.9, UX-48).
 *
 * **A vocabulary in a module with no `'use client'`, and that is the whole point of the file.**
 * `version-pin-indicator.tsx` is a client module, so every export it carries becomes a client reference — an
 * `as const` object read from a Server Component is `undefined`, silently, on both sides of the
 * boundary. `primitives/button-vocabulary.ts` carries the full account and the defect that found
 * it. This one had no server reader yet; it would have failed the same way on the first.
 */
export const VERSION_PIN_STANDING = {
  /** The registered version this record was pinned to, still current. */
  IN_FORCE: 'in_force',
  /** A newer version has been adopted since. UX-48 forbids passing this silently. */
  SUPERSEDED: 'superseded',
} as const;

export type VersionPinStanding = (typeof VERSION_PIN_STANDING)[keyof typeof VERSION_PIN_STANDING];
