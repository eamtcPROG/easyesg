/**
 * S-08's two weights of a finding, and the third place a finding can stand (task 42.2; `architecture.md` §12.5.6's
 * task-42 row (b), (c)) — the Reporting Core artboard's *Must fix* and *Review*, and *cleared since the last check*.
 *
 * **In a module of its own and without a directive**, the package's rule for every vocabulary: S-08's rows are drawn by
 * Client Components and read by the app's tools, and an `as const` exported from a `'use client'` module reaches a
 * Server Component as `undefined`.
 *
 * Which verdict carries which weight is the app's (`design_spec.md` S-08's amendment of 8 Oct 2026); this package
 * draws them. Nothing is gated by either (182/27).
 */
export const FINDING_WEIGHT = {
  /** The report would be wrong or incomplete as filed. */
  MUST_FIX: 'must_fix',
  /** It looks unusual, and a person should decide. */
  REVIEW: 'review',
  /** Found by the last run and no longer raised by the answers held now — kept in view, not removed. */
  CLEARED: 'cleared',
} as const;

export type FindingWeight = (typeof FINDING_WEIGHT)[keyof typeof FINDING_WEIGHT];
