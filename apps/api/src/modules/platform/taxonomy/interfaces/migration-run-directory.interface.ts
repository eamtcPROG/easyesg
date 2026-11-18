import type { Compatibility } from '../domain/version-mapping';

/** A run as the worker executes it (task 67.24). */
export interface RunToExecute {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly toTemplateVersion: string;
  readonly determination: Compatibility;
  readonly reportIds: readonly string[];
  readonly reverted: boolean;
}

/**
 * The worker's unbound reads for a run (task 67.24) — the run itself, a platform row, and which organization each
 * selected report belongs to, under `report_worker_directory_select`, which holds only while no organization is bound.
 * A deleted report is in no organization's list: the restrictive `report_not_deleted` hides it from the worker too.
 */
export interface MigrationRunDirectory {
  run(input: { readonly id: string }): Promise<RunToExecute | null>;

  organizationsOf(input: { readonly reportIds: readonly string[] }): Promise<
    readonly { readonly organizationId: string; readonly reportIds: readonly string[] }[]
  >;
}

export const MIGRATION_RUN_DIRECTORY = Symbol('MIGRATION_RUN_DIRECTORY');
