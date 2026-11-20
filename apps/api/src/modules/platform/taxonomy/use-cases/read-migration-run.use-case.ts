import { MigrationRunNotFoundError } from '../errors/taxonomy-console.errors';
import type { MigrationRunStore } from '../interfaces/migration-run-store.interface';
import type { MigrationRunDetail } from '../models/migration-run.model';

/** One run's progress and partial result, organization by organization — counts only (task 67.23; 182/43). */
export class ReadMigrationRun {
  constructor(private readonly runs: MigrationRunStore) {}

  async execute(query: { readonly id: string; readonly requesterId: string }): Promise<MigrationRunDetail> {
    const run = await this.runs.read(query);
    if (run === null) throw new MigrationRunNotFoundError();
    return run;
  }
}
