import type { ReportMigrationStatus, RestoreAnswer } from '@api/contracts/report-migration';
import type { RunToExecute } from './migration-run-directory.interface';

/** One report's place in a run, with what a notice names it by. */
export interface ReportMigrationOutcome {
  readonly reportId: string;
  readonly status: ReportMigrationStatus;
  readonly entityName: string;
  readonly fiscalYear: number;
}

/**
 * One organization's half of a run, **on the transaction `TENANT_WORK` bound to it** (task 67.24; 182/42) — so row
 * security confines every statement to that organization and none of them names it.
 */
export interface ReportMigrations {
  /**
   * Moves one report and keeps what it was, in this transaction: the report locked, its values and derivation inputs
   * copied into the run's row, its pins moved. A report the run already settled is left as it is; one the run may not
   * move is recorded `skipped`; a deleted one records nothing. Answers the row's status, or null for nothing recorded.
   */
  migrate(input: { readonly run: RunToExecute; readonly reportId: string }): Promise<ReportMigrationStatus | null>;

  /** Records a report the run could not move, after its own transaction rolled back. */
  recordFailure(input: { readonly run: RunToExecute; readonly reportId: string; readonly error: string }): Promise<void>;

  /** Every report of the organization the run reached, and where each stands. */
  outcomes(input: { readonly runId: string }): Promise<readonly ReportMigrationOutcome[]>;

  /** The run's rows a revert puts back — migrated or awaiting review. */
  restorable(input: { readonly runId: string }): Promise<readonly string[]>;

  /** `core.restore_report_migration`, recording the platform's revert. */
  restore(input: { readonly migrationId: string }): Promise<RestoreAnswer>;

  /** Editors and the Organization Administrator — told a compatible run moved their report (182/135). */
  editors(): Promise<readonly string[]>;

  /** The Organization Administrators — who accept or decline a breaking run's result (182/43). */
  administrators(): Promise<readonly string[]>;
}

export const REPORT_MIGRATIONS = Symbol('REPORT_MIGRATIONS');
