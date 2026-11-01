/**
 * The SQLSTATEs this schema answers with a domain error, and the predicates that read them.
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
 * **The identity stores were the same shape again, found by task 186** and folded in by task 209: the account,
 * invitation and social sign-in stores and the admin realm's invitation rows each declared their own `'23505'` and read
 * the constraint off `driverError` by hand, and the last of them had already grown `violatesUniqueIndex` for its two
 * stores — the shared predicate, living with one of its readers rather than with the vocabulary.
 *
 * **Class 45 is ours by the standard's own leave** (task 31.2): SQLSTATE reserves it for
 * applications, so a lock refusal is distinguishable from every other plpgsql error in the schema.
 * `raise_exception` (P0001) would have made them all look alike.
 */
export const SQL_STATE = {
  /** PostgreSQL's `unique_violation` — one report per period, one value per element, one period per entity and year. */
  UNIQUE_VIOLATION: '23505',
  /** PostgreSQL's `exclusion_violation` — the no-overlap constraint on reporting periods. */
  EXCLUSION_VIOLATION: '23P01',
  /** PostgreSQL's `check_violation` — the disclosure state vocabulary and its reason pairing. */
  CHECK_VIOLATION: '23514',
  /** PostgreSQL's `insufficient_privilege` — a column-level grant refusing a write (DR-6). */
  INSUFFICIENT_PRIVILEGE: '42501',
  /** Ours. Raised by every lock trigger: the period's, the report's and the disclosure value's. */
  LOCKED: '45001',
  /** Ours. Raised by the report-scoped guard where the report's entity is archived (task 214), ahead of `LOCKED`. */
  ARCHIVED: '45002',
} as const;

export type SqlState = (typeof SQL_STATE)[keyof typeof SQL_STATE];

export const hasSqlState = (error: unknown, state: SqlState): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === state;

/**
 * A unique violation raised by the named index — how a key, rather than a read before the write, refuses a duplicate,
 * and which key it was where a table holds several (the account's address and a provider's subject; a period's fiscal
 * year and its composite foreign-key target).
 *
 * **The constraint is read off the error itself**: TypeORM 1.1's `QueryFailedError` copies the driver error's own
 * properties onto itself, `constraint` among them, as `hasSqlState` reads `code` — so neither predicate reaches into
 * `driverError`. A unique *constraint* is backed by an index of its own name, which is the name PostgreSQL reports, so
 * one parameter serves both.
 */
export const violatesUniqueIndex = (input: { readonly error: unknown; readonly index: string }): boolean => {
  const { error } = input;
  return (
    hasSqlState(error, SQL_STATE.UNIQUE_VIOLATION) &&
    typeof error === 'object' &&
    error !== null &&
    'constraint' in error &&
    error.constraint === input.index
  );
};
