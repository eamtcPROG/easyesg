import { Injectable, Logger } from '@nestjs/common';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { RunsDaily } from '@api/infrastructure/schedule/runs-daily';
import { SUPPORT_REQUEST_PURGE, SUPPORT_REQUEST_PURGE_SLOT } from '../constants/support.constants';
import { PurgeSupportRequests } from '../use-cases/purge-support-requests.use-case';

/**
 * The night's purge of support requests, on the worker, from the outbox row `ScheduleTicker` writes at its slot
 * (task 77; §12.5.7) — the third `@RunsDaily` job, `CookieChoicePurgeHandler`'s shape. **The moment is the row's**, so
 * a purge retried hours later deletes what that night's would have.
 */
@Injectable()
@HandlesJob(SUPPORT_REQUEST_PURGE)
@RunsDaily(SUPPORT_REQUEST_PURGE_SLOT)
export class SupportRequestPurgeHandler implements JobHandler {
  private readonly logger = new Logger(SupportRequestPurgeHandler.name);

  constructor(private readonly purge: PurgeSupportRequests) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const asOf = new Date(Math.floor(occurredAtMicrosOf(payload, context.jobName) / 1000));
    const deleted = await this.purge.execute({ asOf });
    this.logger.log(`Deleted ${deleted} support request(s) older than 24 months`);
  }
}
