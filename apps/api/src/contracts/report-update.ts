/**
 * FR-166's report-update notice — **one category for its three halves** (182/135, 182/136): a replaced factor set
 * (task 37.3), a taxonomy version a run moved a report to (task 67.24), and an applicability threshold that changed a
 * report's outcome (task 67.8). In `contracts/` because its producers sit in three modules and its wording is one.
 * The spellings below are the catalogue's own copy of these vocabularies, in `notification.reporting.report_update`,
 * whose every message selects on `cause` and then on `reach`.
 */

/**
 * How many of the organization's reports the change reaches — **one or several, never a count**: with one the notice
 * names the report and opens it, with several it says so and opens the list. A count fixed when the notice opens would
 * only go stale.
 */
export const REPORT_UPDATE_REACH = {
  ONE: 'one',
  SEVERAL: 'several',
} as const;

export type ReportUpdateReach = (typeof REPORT_UPDATE_REACH)[keyof typeof REPORT_UPDATE_REACH];

/** Why the reports changed — the wording's first choice (tasks 67.24, 67.8). */
export const REPORT_UPDATE_CAUSE = {
  /** The emission factors a run used were replaced; recalculate (task 37.3). */
  FACTOR_SET: 'factors',
  /** A compatible migration run moved the report to a newer version; nothing to do (task 67.24). */
  TAXONOMY_VERSION: 'migrated',
  /** A breaking migration run moved the report and awaits the administrator's acceptance (tasks 67.24, 67.20). */
  TAXONOMY_REVIEW: 'review',
  /** An applicability threshold changed what the report asks (task 67.8). */
  THRESHOLD: 'thresholds',
} as const;

export type ReportUpdateCause = (typeof REPORT_UPDATE_CAUSE)[keyof typeof REPORT_UPDATE_CAUSE];

/**
 * What the notice carries, fixed when it is raised (§12.5.6's task-50.1 row (18)). `setLabel` and `newSetLabel` are the
 * factor half's, `version` the taxonomy half's; each is empty where its cause does not use it, and `entityName` and
 * `fiscalYear` where several reports are reached. A type rather than an interface, so `raise()`'s parameters accept it.
 */
export type ReportUpdateParams = {
  readonly cause: ReportUpdateCause;
  readonly reach: ReportUpdateReach;
  readonly setLabel: string;
  readonly newSetLabel: string;
  readonly version: string;
  readonly entityName: string;
  readonly fiscalYear: string;
};
