/**
 * FR-166's factor half — the notice a replaced factor set raises (task 37.3; `architecture.md` §12.5.6's
 * task-37.3/37.4 row (6)).
 */

/** The category's vocabularies and params are `contracts/report-update.ts`'s since task 67.24, shared by its three halves. */
export {
  REPORT_UPDATE_CAUSE,
  REPORT_UPDATE_REACH,
  type ReportUpdateCause,
  type ReportUpdateParams,
  type ReportUpdateReach,
} from '@api/contracts/report-update';

/** One open report whose latest run used the set leaving, as the notice names it. */
export interface AffectedReport {
  readonly reportId: string;
  readonly entityName: string;
  readonly fiscalYear: number;
}
