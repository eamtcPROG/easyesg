import type { RestoreAnswer } from '@api/contracts/report-migration';
import type { AwaitingMigration } from '../models/report-migration-review.model';

/**
 * The organization's decision on a migrated report (task 67.20; 182/43) — **on the request's transaction**, so row
 * security confines every statement to the bound organization. A decline is `core.restore_report_migration`, the one
 * writer of a pin the request tier has (task 31.3).
 */
export interface ReportMigrationDecisionStore {
  /** The report's migration awaiting review, or null — none ever, or already decided. */
  awaiting(query: { readonly reportId: string }): Promise<AwaitingMigration | null>;

  /** Records the acceptance — false where it is no longer awaiting, a colleague having decided first. */
  accept(command: { readonly migrationId: string; readonly accountId: string }): Promise<boolean>;

  /** Puts the report back as it was before the run, recording who declined. */
  decline(command: { readonly migrationId: string; readonly accountId: string }): Promise<RestoreAnswer>;

  /** How many of the organization's reports the run still holds for a decision. */
  stillAwaiting(query: { readonly runId: string }): Promise<number>;
}

export const REPORT_MIGRATION_DECISION_STORE = Symbol('REPORT_MIGRATION_DECISION_STORE');
