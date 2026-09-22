/**
 * Badge's tones (task 50.2.1) — a directive-free sibling module, this package's standing shape for a vocabulary,
 * so a Server Component reading one gets the value and not a client reference.
 *
 * **Semantic rather than chromatic**, as `STATUS_TONE` is: a caller says what the count is for, never which colour.
 */
export const BADGE_TONE = {
  /** A count to notice and not to worry about — how many notices wait unread. The band's light plate. */
  QUIET: 'quiet',
  /** A count that asks for attention where it stands — the same number beside S-26's own heading. */
  ALERT: 'alert',
} as const;

export type BadgeTone = (typeof BADGE_TONE)[keyof typeof BADGE_TONE];
