/**
 * Normalise what `query()` gives back, because **TypeORM shapes it per SQL command**.
 *
 * `SELECT` and `INSERT ... RETURNING` yield the rows; `UPDATE ... RETURNING` and
 * `DELETE ... RETURNING` yield `[rows, rowCount]` — TypeORM builds `raw` with a switch on the
 * driver's `command`. So the identical `RETURNING` clause reads as `rows[0].id` after an insert and
 * as `undefined` after an update, with no error where it was written: it surfaces later as a
 * `TypeError` on a property of what should have been a row. `apps/api/CLAUDE.md` records that as
 * having cost a day on task 19, on the first `UPDATE ... RETURNING` in the codebase.
 *
 * **One module because it was already four** (task 31.1). `account-store` and `session-store` each
 * declared it — the second with a comment pointing at the first — while `organization-store` and
 * `admin:provision` hand-rolled the same test inline. That is the shape CLAUDE.md names for
 * `toLocale`: a helper retyped per caller, every copy locally correct, and nothing able to see them
 * diverge. Writing a fifth for the reporting period is what surfaced it.
 */
export const returnedRows = <T>(result: unknown): T[] =>
  Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);
