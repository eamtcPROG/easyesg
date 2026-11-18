import type { TaxonomyMappings } from '@api/contracts/taxonomy-mapping.port';
import type { MigrationRunStore } from '../interfaces/migration-run-store.interface';
import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';
import type { MigrationSelectionPreview } from '../models/migration-run.model';
import { resolveRunPair, type RunPair } from './run-pair';

export interface PreviewMigrationRunCommand extends RunPair {
  readonly organizationIds: readonly string[] | null;
  readonly requesterId: string;
}

/**
 * UC-78's blast radius before a run starts (task 67.23; UX-123) — the determination the run would move reports by, how
 * many it would select across how many organizations, and how many on the version it leaves out as read-only. Writes
 * nothing but the read's own acquisition row.
 */
export class PreviewMigrationRun {
  constructor(
    private readonly console: TaxonomyConsoleStore,
    private readonly mappings: TaxonomyMappings,
    private readonly runs: MigrationRunStore,
  ) {}

  async execute(command: PreviewMigrationRunCommand): Promise<MigrationSelectionPreview> {
    const { determination } = await resolveRunPair({ pair: command, console: this.console, mappings: this.mappings });
    const selection = await this.runs.select(command);
    return {
      determination,
      reports: selection.reportIds.length,
      organizations: selection.organizations,
      leftOut: selection.leftOut,
    };
  }
}
