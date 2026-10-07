/**
 * FR-166's factor half — the notice a replaced factor set raises (task 37.3; `architecture.md` §12.5.6's
 * task-37.3/37.4 row (6)).
 */

/**
 * How many of the organization's reports the replacement reaches — the value the category's wording selects on.
 *
 * **One or several, never a count**: with one the notice names the report and opens its calculator, with several it
 * says so and opens the reports list. A count fixed when the notice opens would only go stale as reports are
 * recalculated. The two spellings are the catalogue's own copy of this vocabulary, in
 * `notification.reporting.report_update`.
 */
export const REPORT_UPDATE_REACH = {
  ONE: 'one',
  SEVERAL: 'several',
} as const;

export type ReportUpdateReach = (typeof REPORT_UPDATE_REACH)[keyof typeof REPORT_UPDATE_REACH];

/**
 * What the notice carries, fixed when it is raised (§12.5.6's task-50.1 row (18)): the label of the set the runs used,
 * the label of the set now in force, and — where one report is reached — its entity and year, the year as text for
 * `ReminderParams`' reason. Empty where several are. A type rather than an interface, so it is a record `raise()`'s
 * parameters accept.
 */
export type ReportUpdateParams = {
  readonly reach: ReportUpdateReach;
  readonly setLabel: string;
  readonly newSetLabel: string;
  readonly entityName: string;
  readonly fiscalYear: string;
};

/** One open report whose latest run used the set leaving, as the notice names it. */
export interface AffectedReport {
  readonly reportId: string;
  readonly entityName: string;
  readonly fiscalYear: number;
}
