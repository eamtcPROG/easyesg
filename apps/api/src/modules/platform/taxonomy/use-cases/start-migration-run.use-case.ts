import type { TaxonomyMappings } from '@api/contracts/taxonomy-mapping.port';
import { TAXONOMY_STANDARD } from '../constants/taxonomy.constants';
import { MigrationRunEmptyError } from '../errors/taxonomy-console.errors';
import type { MigrationRunStore } from '../interfaces/migration-run-store.interface';
import type { TaxonomyConsoleStore } from '../interfaces/taxonomy-console-store.interface';
import { resolveRunPair, type RunPair } from './run-pair';

export interface StartMigrationRunCommand extends RunPair {
  readonly organizationIds: readonly string[] | null;
  readonly operatorId: string;
}

/**
 * UC-78's start (task 67.23; FR-69; 182/42; AD-10) — the selection fixed at the moment the run starts, recorded with the
 * pair's determination as it stood, and the job queued on the same transaction. **The request returns at once**: the
 * reports are moved by the worker (67.24), one transaction per report, never here. A selection of nothing is refused,
 * since a run that moves nothing would only be a row to explain.
 */
export class StartMigrationRun {
  constructor(
    private readonly console: TaxonomyConsoleStore,
    private readonly mappings: TaxonomyMappings,
    private readonly runs: MigrationRunStore,
  ) {}

  async execute(command: StartMigrationRunCommand): Promise<{ readonly id: string }> {
    const { determination } = await resolveRunPair({ pair: command, console: this.console, mappings: this.mappings });
    const selection = await this.runs.select({
      from: command.from,
      organizationIds: command.organizationIds,
      requesterId: command.operatorId,
    });
    if (selection.reportIds.length === 0) throw new MigrationRunEmptyError();
    return this.runs.start({
      standard: TAXONOMY_STANDARD.VSME,
      from: command.from,
      to: command.to,
      toTemplateVersion: command.toTemplateVersion,
      determination,
      reportIds: selection.reportIds,
      operatorId: command.operatorId,
    });
  }
}
