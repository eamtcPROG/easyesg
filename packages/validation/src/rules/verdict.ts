/**
 * The four verdicts a rule can fire — FR-40's `MISSING VALUE`, `VALUE INCONSISTENCY`, `ERROR` and `INVALID URL` (task
 * 40). `OK` is not among them: a field is `OK` when no finding names it, so there is nothing for a rule to fire.
 *
 * **The wire values are the ones the value row's `CHECK` still lists** as frozen history (§12.5.6's task-182
 * validation row, 182/17) and the generated contract carries, so the findings table task 41.2 adds names them the
 * same way and nothing translates between the two.
 */
export const VERDICT = {
  MISSING_VALUE: 'missing',
  VALUE_INCONSISTENCY: 'inconsistency',
  ERROR: 'error',
  INVALID_URL: 'invalid_url',
} as const;

export type Verdict = (typeof VERDICT)[keyof typeof VERDICT];

/**
 * Most severe first — **the order `design_spec.md` §6.4's colour roles already carry**: error and invalid URL share
 * the error role, inconsistency is the warning role, missing the attention role (*"colour carries severity"*).
 * BR-VAL-1 resolves a field to exactly one state, and a field holding several findings shows the first of these
 * (§12.5.6's task-40 row).
 */
export const VERDICT_SEVERITY: readonly Verdict[] = [
  VERDICT.ERROR,
  VERDICT.INVALID_URL,
  VERDICT.VALUE_INCONSISTENCY,
  VERDICT.MISSING_VALUE,
];

/** The one verdict a field shows among those its findings fire, or `null` where it has none — the field is `OK`. */
export function mostSevereVerdict(verdicts: readonly Verdict[]): Verdict | null {
  return VERDICT_SEVERITY.find((verdict) => verdicts.includes(verdict)) ?? null;
}
