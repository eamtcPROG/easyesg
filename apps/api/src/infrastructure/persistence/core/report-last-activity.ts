/**
 * When a report was last worked on (task 256; `architecture.md` §12.5.6's task-256 row) — an SQL expression for the
 * report reads and the period reads alike, beside `readyToFileOf` and `validationSummaryOf`.
 *
 * **Derived on read, never stored.** An answer, a derivation input or an invoice line is written to its own table, and
 * none of those writes touches `core.report`; so the report row's `updated_at` is the record's own change — its
 * creation, its scope, its status — and says nothing about the work in it. The latest of the four is what S-05's
 * *where you left off* and S-06's *last activity* mean, and it is answered as `lastActivityAt` beside `updatedAt`,
 * which keeps meaning the record's own change. Moving `core.report.updated_at` on every answer instead was declined
 * (project owner, 21 Nov 2026): one report-row update per autosave flush, serialising the editors of one report.
 *
 * **The reporter's work and nothing else.** A validation run and an export are checks of the work, not work — and the
 * worker's daily check runs one on every open report, so counting runs would make every report *last active* each
 * night. A removed invoice line leaves no row to read, so a removal alone does not move the time.
 *
 * `report` is the alias the calling statement gives `core.report`. **`GREATEST` skips a `NULL`**, which is what a
 * report holding no answers answers, so the record's own change is the floor. Each subquery is scoped by the report and
 * its organization, under the same row security as the report it is joined to, and each table indexes on its report.
 */
export const lastActivityOf = (report: string): string =>
  `GREATEST(${report}.updated_at,
     (SELECT max(dv.updated_at) FROM core.report_disclosure_value dv
       WHERE dv.report_id = ${report}.id AND dv.organization_id = ${report}.organization_id),
     (SELECT max(di.updated_at) FROM core.report_derivation_input di
       WHERE di.report_id = ${report}.id AND di.organization_id = ${report}.organization_id),
     (SELECT max(cs.updated_at) FROM core.calc_source cs
       WHERE cs.report_id = ${report}.id AND cs.organization_id = ${report}.organization_id))`;
