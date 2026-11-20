import type { MigrationRunStore } from '../interfaces/migration-run-store.interface';
import type { MigrationRunSummary } from '../models/migration-run.model';

/** A-04's list of runs, newest first, each with its counts (task 67.23). */
export class ReadMigrationRuns {
  constructor(private readonly runs: MigrationRunStore) {}

  execute(query: { readonly requesterId: string }): Promise<readonly MigrationRunSummary[]> {
    return this.runs.list(query);
  }
}
