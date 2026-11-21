import { Injectable, Logger } from '@nestjs/common';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { RunsDaily } from '@api/infrastructure/schedule/runs-daily';
import { LAPSED_ACCOUNT_SWEEP, LAPSED_ACCOUNT_SWEEP_SLOT } from '../constants/account.constants';
import { ReclaimLapsedAccounts } from '../use-cases/reclaim-lapsed-accounts.use-case';

/**
 * The night's sweep of accounts past OQ-52's seven days, on the worker, from the outbox row `ScheduleTicker` writes at
 * its slot (task 200; §12.5.6's task-200 row (4)) — the fifth `@RunsDaily` job.
 *
 * **The slot's moment is read, and only for the log**: a job carrying none did not come from the dispatcher, so it is
 * refused before anything is deleted, as every handler refuses a payload it cannot read. What goes is the database
 * function's to say, by its own clock (row (1)). The log carries the count and never an address (NFR-30).
 */
@Injectable()
@HandlesJob(LAPSED_ACCOUNT_SWEEP)
@RunsDaily(LAPSED_ACCOUNT_SWEEP_SLOT)
export class LapsedAccountSweepHandler implements JobHandler {
  private readonly logger = new Logger(LapsedAccountSweepHandler.name);

  constructor(private readonly reclaim: ReclaimLapsedAccounts) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const slot = new Date(Math.floor(occurredAtMicrosOf(payload, context.jobName) / 1000));
    const reclaimed = await this.reclaim.execute();
    this.logger.log(
      `Deleted ${reclaimed} account(s) left unverified or in setup past their seven days, for the slot of ${slot.toISOString()}`,
    );
  }
}
