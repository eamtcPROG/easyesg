/**
 * Where a report stands in a taxonomy migration run (tasks 67.19, 67.20, 67.23, 67.24; UC-78, UC-79; FR-69, FR-70;
 * 182/41 … 182/43) — the vocabulary `core.report_migration.status` holds, which the run's worker writes, the console
 * counts and the organization's acceptance moves. **In `contracts/`** because two contexts read it: the run is
 * `platform/taxonomy`'s and the decision on a migrated report is `core/disclosure`'s, and neither may import the other.
 * The table's `CHECK` is the database's own copy (the migration stays literal).
 */
export const REPORT_MIGRATION_STATUS = {
  /** A compatible change, in force with nothing to decide. */
  MIGRATED: 'migrated',
  /** A breaking change, waiting for the Organization Administrator to accept or decline it (182/43). */
  AWAITING_REVIEW: 'awaiting_review',
  ACCEPTED: 'accepted',
  /** Declined by the organization: the pre-migration state put back. */
  DECLINED: 'declined',
  /** Reverted with the whole run by the platform: the pre-migration state put back. */
  REVERTED: 'reverted',
  /** Nothing moved; the error kept for a retry. */
  FAILED: 'failed',
  /** The report no longer stood where the run found it — another pin, or a locked period, which a run never restates. */
  SKIPPED: 'skipped',
} as const;

export type ReportMigrationStatus = (typeof REPORT_MIGRATION_STATUS)[keyof typeof REPORT_MIGRATION_STATUS];

export const isReportMigrationStatus = (value: unknown): value is ReportMigrationStatus =>
  typeof value === 'string' && (Object.values(REPORT_MIGRATION_STATUS) as readonly string[]).includes(value);

/** `core.restore_report_migration`'s answer — the function's own four words, as it spells them. */
export const RESTORE_ANSWER = {
  RESTORED: 'restored',
  NOT_FOUND: 'not_found',
  NOT_RESTORABLE: 'not_restorable',
  LOCKED: 'locked',
} as const;

export type RestoreAnswer = (typeof RESTORE_ANSWER)[keyof typeof RESTORE_ANSWER];

/** What a restore records — the organization's decline, or the platform's revert of a whole run. */
export const RESTORE_OUTCOME = {
  DECLINED: REPORT_MIGRATION_STATUS.DECLINED,
  REVERTED: REPORT_MIGRATION_STATUS.REVERTED,
} as const;

export type RestoreOutcome = (typeof RESTORE_OUTCOME)[keyof typeof RESTORE_OUTCOME];

/** FR-167's subject of a run's notice in an organization: one run, one notice, folded across a retry. */
export const migrationRunSubject = (runId: string): string => `migration-run/${runId}`;
