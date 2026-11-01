import { Injectable, Logger } from '@nestjs/common';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { RunsDaily } from '@api/infrastructure/schedule/runs-daily';
import { COOKIE_CHOICE_PURGE, COOKIE_CHOICE_PURGE_SLOT } from '../constants/cookie-choice.constants';
import { PurgeCookieChoices } from '../use-cases/purge-cookie-choices.use-case';

/**
 * The night's purge of the cookie banner's answers, on the worker, from the outbox row `ScheduleTicker` writes at its
 * slot (task 223; §12.5.6's task-223 row (4)) — the second `@RunsDaily` job. **The adapter and nothing more**: it reads
 * the moment the slot opened and hands it to `PurgeCookieChoices`.
 *
 * **The moment is the row's, not the handler's clock**, `ReportNoticeSweepHandler`'s reason: a purge retried hours later
 * deletes what that night's would have.
 */
@Injectable()
@HandlesJob(COOKIE_CHOICE_PURGE)
@RunsDaily(COOKIE_CHOICE_PURGE_SLOT)
export class CookieChoicePurgeHandler implements JobHandler {
  private readonly logger = new Logger(CookieChoicePurgeHandler.name);

  constructor(private readonly purge: PurgeCookieChoices) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const asOf = new Date(Math.floor(occurredAtMicrosOf(payload, context.jobName) / 1000));
    const deleted = await this.purge.execute({ asOf });
    this.logger.log(`Deleted ${deleted} cookie answer(s) older than their cookie`);
  }
}
