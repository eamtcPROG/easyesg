import { Injectable } from '@nestjs/common';
import { HandlesJob, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { TAXONOMY_MIGRATION_RUN_REQUESTED } from '../constants/taxonomy.constants';
import { ExecuteMigrationRun } from '../use-cases/execute-migration-run.use-case';
import { readRunId } from './run-id';

/**
 * A migration run started or retried, on the worker, from the outbox (tasks 67.23, 67.24; AD-10). The adapter and
 * nothing more: it reads the run's id and hands it to `ExecuteMigrationRun`, which moves what the run has not moved.
 */
@Injectable()
@HandlesJob(TAXONOMY_MIGRATION_RUN_REQUESTED)
export class MigrationRunRequestedHandler implements JobHandler {
  constructor(private readonly executeMigrationRun: ExecuteMigrationRun) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    await this.executeMigrationRun.execute({ runId: readRunId({ payload, job: TAXONOMY_MIGRATION_RUN_REQUESTED }) });
  }
}
