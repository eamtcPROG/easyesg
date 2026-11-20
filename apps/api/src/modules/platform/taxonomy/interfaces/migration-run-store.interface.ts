import type { Compatibility } from '../domain/version-mapping';
import type { MigrationRunDetail, MigrationRunSummary } from '../models/migration-run.model';

/** The reports a run would select, chosen across organizations through the logged read-only door (D-5, §7.6). */
export interface MigrationSelection {
  readonly reportIds: readonly string[];
  readonly organizations: number;
  /** On the version, but read-only: a locked period or an archived entity. */
  readonly leftOut: number;
}

/**
 * A migration run's request-tier store (task 67.23) — the selection and the console's reads through `esg_admin_ro`,
 * logged first; the run's record and its jobs written as `esg_app`, the job on the transaction that records the decision
 * (P-8), so a run started is a run the worker will execute.
 */
export interface MigrationRunStore {
  select(input: {
    readonly from: string;
    /** Narrows the run to these organizations; null selects every organization's reports. */
    readonly organizationIds: readonly string[] | null;
    readonly requesterId: string;
  }): Promise<MigrationSelection>;

  start(input: {
    readonly standard: string;
    readonly from: string;
    readonly to: string;
    readonly toTemplateVersion: string;
    readonly determination: Compatibility;
    readonly reportIds: readonly string[];
    readonly operatorId: string;
  }): Promise<{ readonly id: string }>;

  list(input: { readonly requesterId: string }): Promise<readonly MigrationRunSummary[]>;

  read(input: { readonly id: string; readonly requesterId: string }): Promise<MigrationRunDetail | null>;

  /** Queues the run again; the worker moves only what it has not moved, which after a failure is what failed. */
  requestRetry(input: { readonly id: string }): Promise<void>;

  /** Marks the run reverted and queues the reversion — false where it already was, and nothing is queued. */
  markReverted(input: { readonly id: string; readonly operatorId: string }): Promise<boolean>;
}

export const MIGRATION_RUN_STORE = Symbol('MIGRATION_RUN_STORE');
