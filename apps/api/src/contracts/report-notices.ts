/**
 * The keys of FR-164's and FR-165's notices (task 51.2; `architecture.md` §12.5.6's task-51.2 row, (c)).
 *
 * **One spelling for the three places that name them**: the scheduled check raises and cancels them (`core/validation`),
 * the write that answers the last outstanding field cancels one (`core/disclosure`), and a lock cancels both
 * (`core/period`). A cancellation names the raise's key exactly (FR-167), so a second spelling anywhere is a notice that
 * is never withdrawn — beside the port, in the one surface those modules share.
 */

/** The outstanding-report notice: one per report, its audience the default. */
export const outstandingReportSubject = (reportId: string): string => `report:${reportId}:outstanding`;

/** A deadline notice: one per period and lead time, each its own notice (182/132). */
export const reportDeadlineSubject = (input: { readonly periodId: string; readonly leadTimeDays: number }): string =>
  `period:${input.periodId}:deadline:${input.leadTimeDays}`;
