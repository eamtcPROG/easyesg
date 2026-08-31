/**
 * The report — FR-24 … FR-32, FR-66, FR-177 (task 31.3; UC-17, UC-18).
 *
 * Not TypeORM entities (AD-14 constraint 1), and instants are `Date`: epoch-ms is the wire's
 * representation, converted at the DTO boundary (OQ-50).
 */

/**
 * D-A's report-level scope — the `report_scope_known` CHECK's vocabulary.
 *
 * **Comprehensive is additive over Basic, never a second report.** FR-177 makes C1–C9 authorable
 * through the same wizard as B1–B11, driven by this one value, and settable both at creation and on
 * a report already in progress. That is why it is a flag on the report rather than a second row or
 * a second table: the same disclosures, the same validation and the same two export formats, over a
 * larger element set.
 *
 * It is also the axis a plan is sold on (`problem_overview.md` §6.1 row 15), which is why task 54's
 * entitlement guard will read it. Ungated until then, recorded as a deferral on this task's row.
 */
export const REPORT_SCOPE = {
  /** VSME Basic Module, B1–B11. The default and the legal ceiling on counterparty requests (D-A). */
  BASIC: 'basic',
  /** Basic plus the Comprehensive Module, C1–C9, authored over it (FR-177). */
  BASIC_AND_COMPREHENSIVE: 'basic_and_comprehensive',
} as const;

export type ReportScope = (typeof REPORT_SCOPE)[keyof typeof REPORT_SCOPE];

/**
 * The scope a report is created with when the caller names none.
 *
 * **Beside the vocabulary rather than at the call site**, per CLAUDE.md's rule that an operation
 * over a closed set belongs with the set: a default *is* a statement about the vocabulary, and a
 * copy in the DTO and another in the use case is how the OpenAPI `default` and the actual behaviour
 * come to disagree.
 *
 * Basic, because D-A makes it the product boundary — VSME's Basic Module is the legal ceiling on
 * what a counterparty may request — and because Comprehensive is the paid tier, which is not a
 * thing to opt somebody into by omission.
 */
export const DEFAULT_REPORT_SCOPE: ReportScope = REPORT_SCOPE.BASIC;

/**
 * The report lifecycle — the `report_status_known` CHECK's vocabulary.
 *
 * **Four states are declared and two are reachable**, which is stated rather than left to be
 * discovered (§12.5.6's task-31.3 row). `OPEN` and `LOCKED` are written **only by the period lock**:
 * FR-22 makes the lock a property of the reporting period, and this column is its shadow inside the
 * report, moved in the same transaction so the two cannot disagree. Nothing else may write them.
 *
 * `READY_TO_FILE` arrives with task 41.3's completion roll-up and `FILED` with task 47's export
 * history. They are declared now because the column's `CHECK` is frozen history the day it ships and
 * because both prototypes draw all four; they are unwritten until their owners land.
 */
export const REPORT_STATUS = {
  /** Authorable. The state a report is created in. */
  OPEN: 'open',
  /** The period is locked, so the report takes no writes from anyone (FR-22). */
  LOCKED: 'locked',
  /** Complete and validated, awaiting filing. Written by task 41.3, not yet reachable. */
  READY_TO_FILE: 'ready_to_file',
  /** Filed. Written by task 47's export history, not yet reachable. */
  FILED: 'filed',
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

export interface Report {
  readonly id: string;
  /** The period this report covers. At most one report per period, so this identifies it too. */
  readonly reportingPeriodId: string;
  readonly scope: ReportScope;
  readonly status: ReportStatus;
  /**
   * DR-4's pin — FR-66's *explicit template and taxonomy version against every report*.
   *
   * **Copied from the period at creation and never resolved a second time** (§12.5.6's task-31.3
   * row): the registry is asked once, at period open, for the period's own start date. `esg_app`
   * holds no `UPDATE` privilege on either column, so nothing in the request tier can move one —
   * the guarantee is the database's, not this interface's.
   */
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * What creating a report establishes.
 *
 * **The pins are absent by construction**, as they are on `NewReportingPeriod` and for a sharper
 * reason here: a caller who could name a version could pin a filing to one of their choosing, which
 * is DR-4 inverted. They are read from the period.
 *
 * `status` is absent too — a report is created open, and the period lock is the only thing that
 * moves it.
 */
export interface NewReport {
  readonly reportingPeriodId: string;
  readonly scope: ReportScope;
}

/**
 * What a later edit may name. **`scope` and nothing else** — FR-177 requires the flag settable on a
 * report already in progress, and every other column is either the pin, the lock's shadow, or
 * identity.
 */
export interface ReportPatch {
  readonly scope?: ReportScope;
}
