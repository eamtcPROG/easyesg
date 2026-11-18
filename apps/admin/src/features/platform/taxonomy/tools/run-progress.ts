import { REPORT_MIGRATION_STATUS, type MigrationRunSummary, type MigrationTallyEntry, type ReportMigrationStatus } from '@easyesg/contracts';

/**
 * A run's progress as A-04 reads it (tasks 67.23, 67.7) — pure, so the poll's stop, the counts drawn and the retry's
 * offer are each one function with a spec.
 */

/** Whether the worker is still moving the run — what keeps its read polling. A reverted run is moving no further. */
export const runIsMoving = (run: Pick<MigrationRunSummary, 'pending' | 'revertedAt'>): boolean =>
  run.revertedAt === null && run.pending > 0;

/** One status's count from a tally, zero where the api answered none. */
export const reportsIn = (tally: readonly MigrationTallyEntry[], status: ReportMigrationStatus): number =>
  tally.find((entry) => entry.status === status)?.reports ?? 0;

/** A retry moves only failed reports, so it is offered while some failed and the run stands — the api's own rule. */
export const retryOffered = (run: Pick<MigrationRunSummary, 'tally' | 'revertedAt'>): boolean =>
  run.revertedAt === null && reportsIn(run.tally, REPORT_MIGRATION_STATUS.FAILED) > 0;

/** A revert is offered once per run, while it stands. */
export const revertOffered = (run: Pick<MigrationRunSummary, 'revertedAt'>): boolean => run.revertedAt === null;

/** The statuses a run's table shows, in the vocabulary's order, leaving out the ones no report holds. */
export const shownStatuses = (tally: readonly MigrationTallyEntry[]): readonly ReportMigrationStatus[] =>
  Object.values(REPORT_MIGRATION_STATUS).filter((status) => reportsIn(tally, status) > 0);
