import { REPORT_MIGRATION_STATUS, type ReportMigrationStatus } from '@api/contracts/report-migration';
import { COMPATIBILITY, type Compatibility } from './version-mapping';

/**
 * A migration run's arithmetic (tasks 67.23, 67.24; UC-78; FR-69; 182/41 … 182/43; §12.5.6's task-67.23 row) — pure,
 * so the console's counts, the worker's decision per report and the retry's refusal are each one function.
 */

/** Where a report the run moves lands: in force for a compatible pair, awaiting its organization for a breaking one. */
export const movedStatusOf = (determination: Compatibility): ReportMigrationStatus =>
  determination === COMPATIBILITY.COMPATIBLE ? REPORT_MIGRATION_STATUS.MIGRATED : REPORT_MIGRATION_STATUS.AWAITING_REVIEW;

/**
 * Whether a run may move a report as it stands now. **It moves only a report still pinned to the run's `from`**, in a
 * period that is not locked and of an entity not archived: a report another run already moved is not this run's to
 * move, and a locked or archived report is read-only (FR-22, task 214), which a run never restates.
 */
export const mayMove = (input: {
  readonly report: { readonly taxonomyVersion: string; readonly locked: boolean; readonly archived: boolean };
  readonly from: string;
}): boolean => input.report.taxonomyVersion === input.from && !input.report.locked && !input.report.archived;

export type MigrationTally = Readonly<Record<ReportMigrationStatus, number>>;

/** Each status's count of reports, every status present — a status no row holds counts zero rather than going missing. */
export const tallyOf = (rows: readonly { readonly status: ReportMigrationStatus; readonly reports: number }[]): MigrationTally => {
  const tally = Object.fromEntries(Object.values(REPORT_MIGRATION_STATUS).map((status) => [status, 0])) as Record<
    ReportMigrationStatus,
    number
  >;
  for (const row of rows) tally[row.status] += row.reports;
  return tally;
};

/** The selected reports the worker has not reached yet — a run is finished when none is. */
export const pendingOf = (input: { readonly selected: number; readonly tally: MigrationTally }): number =>
  Math.max(0, input.selected - Object.values(input.tally).reduce((sum, count) => sum + count, 0));

/** A retry moves the reports that failed, so a run with none — or one already reverted — has nothing to retry. */
export const retryAdmitted = (input: { readonly tally: MigrationTally; readonly reverted: boolean }): boolean =>
  !input.reverted && input.tally[REPORT_MIGRATION_STATUS.FAILED] > 0;
