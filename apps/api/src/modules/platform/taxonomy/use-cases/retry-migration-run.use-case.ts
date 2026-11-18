import { retryAdmitted } from '../domain/migration-run';
import { MigrationRunNotFoundError, MigrationRunSettledError } from '../errors/taxonomy-console.errors';
import type { MigrationRunStore } from '../interfaces/migration-run-store.interface';

/**
 * A partial result's retry (task 67.23; 182/42's "partial-result and retry"): the run queued again, which the worker
 * reads as *move what is not yet moved* — after a failure, exactly the reports that failed. Refused where nothing failed
 * or the run was reverted.
 */
export class RetryMigrationRun {
  constructor(private readonly runs: MigrationRunStore) {}

  async execute(command: { readonly id: string; readonly operatorId: string }): Promise<{ readonly id: string }> {
    const run = await this.runs.read({ id: command.id, requesterId: command.operatorId });
    if (run === null) throw new MigrationRunNotFoundError();
    if (!retryAdmitted({ tally: run.tally, reverted: run.revertedAt !== null })) throw new MigrationRunSettledError();
    await this.runs.requestRetry({ id: command.id });
    return { id: command.id };
  }
}
