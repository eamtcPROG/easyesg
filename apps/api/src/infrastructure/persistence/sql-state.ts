/**
 * The SQLSTATEs this schema answers with a domain error, and the predicate that reads them.
 *
 * **One module because it was already three** (task 34.1), which is `returned-rows.ts`'s own reason
 * one directory up. `report-store` declared `{ UNIQUE_VIOLATION, LOCKED }`, `reporting-period-store`
 * declared `{ EXCLUSION_VIOLATION, PERIOD_LOCKED }`, and `disclosure-value-store` opened with a bare
 * `const LOCKED = '45001'` and an inlined `typeof error === 'object' && …` — each locally correct,
 * and between them nothing in the tree said whether `LOCKED` and `PERIOD_LOCKED` were one value.
 * They are: `45001` is raised by the period's lock trigger, by the report's, and by the disclosure
 * value's, and a caller distinguishing them by name would be distinguishing nothing.
 *
 * That is the `toLocale` shape CLAUDE.md names — *"a helper whose body mentions an imported
 * vocabulary and nothing else local … not a helper for this file; it is a missing export from the
 * vocabulary's own module"* — and `sonarjs/no-duplicate-string` cannot see it, because `'45001'` is
 * five word-characters and the rule's `MIN_LENGTH` is 10.
 *
 * **Class 45 is ours by the standard's own leave** (task 31.2): SQLSTATE reserves it for
 * applications, so a lock refusal is distinguishable from every other plpgsql error in the schema.
 * `raise_exception` (P0001) would have made them all look alike.
 */
export const SQL_STATE = {
  /** PostgreSQL's `unique_violation` — one report per period, one value per element. */
  UNIQUE_VIOLATION: '23505',
  /** PostgreSQL's `exclusion_violation` — the no-overlap constraint on reporting periods. */
  EXCLUSION_VIOLATION: '23P01',
  /** PostgreSQL's `check_violation` — the disclosure state vocabulary and its reason pairing. */
  CHECK_VIOLATION: '23514',
  /** PostgreSQL's `insufficient_privilege` — a column-level grant refusing a write (DR-6). */
  INSUFFICIENT_PRIVILEGE: '42501',
  /** Ours. Raised by every lock trigger: the period's, the report's and the disclosure value's. */
  LOCKED: '45001',
} as const;

export type SqlState = (typeof SQL_STATE)[keyof typeof SQL_STATE];

export const hasSqlState = (error: unknown, state: SqlState): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === state;
