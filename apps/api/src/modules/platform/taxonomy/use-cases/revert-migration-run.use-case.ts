import { MigrationRunNotFoundError, MigrationRunSettledError } from '../errors/taxonomy-console.errors';
import type { MigrationRunStore } from '../interfaces/migration-run-store.interface';

/**
 * UC-78's way back from a bad mapping (task 67.23; FR-69; 182/41): the run marked reverted and its reversion queued on
 * the same transaction — the worker puts each report it moved back to its retained state, except one its organization
 * has accepted, whose decision a platform revert does not overrule. A run is reverted once.
 */
export class RevertMigrationRun {
  constructor(private readonly runs: MigrationRunStore) {}

  async execute(command: { readonly id: string; readonly operatorId: string }): Promise<{ readonly id: string }> {
    const run = await this.runs.read({ id: command.id, requesterId: command.operatorId });
    if (run === null) throw new MigrationRunNotFoundError();
    if (!(await this.runs.markReverted(command))) throw new MigrationRunSettledError();
    return { id: command.id };
  }
}
