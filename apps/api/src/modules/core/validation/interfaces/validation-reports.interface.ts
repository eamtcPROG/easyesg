/**
 * The report facts a validation run reads before anything else (task 41.2; FR-73 item 9) — whether its period is
 * locked, the rule set its lock pinned, and the zone its days are read in. A narrow port of this module's own,
 * `CalcReports`' shape: one statement over the report and its period, RLS-scoped.
 */
export interface ValidationReport {
  readonly reportId: string;
  /** The period's lock — the report's lock, since the period lock moves every report in it (FR-22). */
  readonly lockedAt: Date | null;
  /** The rule set revision the lock pinned, or null — open, or locked before pins existed (task-41 row (5)). */
  readonly ruleSetPin: number | null;
  /** The period's own zone (`period_start_tz`), which reads *today* and the lock's day (task-41 row (b)). */
  readonly timezone: string;
}

export interface ValidationReports {
  /** `null` where no such report is visible to the bound tenant. */
  find(query: { readonly reportId: string }): Promise<ValidationReport | null>;
}

export const VALIDATION_REPORTS = Symbol('VALIDATION_REPORTS');
