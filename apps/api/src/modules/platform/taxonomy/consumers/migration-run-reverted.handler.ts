import { Injectable, Logger } from '@nestjs/common';
import { HandlesJob, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { TAXONOMY_MIGRATION_RUN_REVERTED } from '../constants/taxonomy.constants';
import { RevertMigrationRunReports } from '../use-cases/revert-migration-run-reports.use-case';
import { readRunId } from './run-id';

/**
 * A migration run reverted, on the worker, from the outbox (tasks 67.23, 67.24). Puts each report the run moved back;
 * a report locked since stays where it is, and the count of those is logged for the operator's runbook.
 */
@Injectable()
@HandlesJob(TAXONOMY_MIGRATION_RUN_REVERTED)
export class MigrationRunRevertedHandler implements JobHandler {
  private readonly logger = new Logger(MigrationRunRevertedHandler.name);

  constructor(private readonly revertMigrationRunReports: RevertMigrationRunReports) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const runId = readRunId({ payload, job: TAXONOMY_MIGRATION_RUN_REVERTED });
    const { locked } = await this.revertMigrationRunReports.execute({ runId });
    if (locked > 0) this.logger.warn(`Migration run ${runId}: ${locked} report(s) locked since the run stay migrated.`);
  }
}
