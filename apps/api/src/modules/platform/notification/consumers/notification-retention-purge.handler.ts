import { Injectable, Logger } from '@nestjs/common';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { RunsDaily } from '@api/infrastructure/schedule/runs-daily';
import { NOTIFICATION_RETENTION_PURGE, NOTIFICATION_RETENTION_PURGE_SLOT } from '../constants/notification.constants';
import { PurgeExpiredNotifications } from '../use-cases/purge-expired-notifications.use-case';

/**
 * The night's purge of notices past their retention, on the worker, from the outbox row `ScheduleTicker` writes at its
 * slot (task 163; §12.5.6's task-163 row (4)) — the fourth `@RunsDaily` job.
 *
 * **The slot's moment is read, and only for the log**: a job carrying none did not come from the dispatcher, so it is
 * refused before anything is deleted, as every handler refuses a payload it cannot read. What is deleted is decided by
 * each table's policy against the database's clock, not by this moment (row (2)).
 */
@Injectable()
@HandlesJob(NOTIFICATION_RETENTION_PURGE)
@RunsDaily(NOTIFICATION_RETENTION_PURGE_SLOT)
export class NotificationRetentionPurgeHandler implements JobHandler {
  private readonly logger = new Logger(NotificationRetentionPurgeHandler.name);

  constructor(private readonly purge: PurgeExpiredNotifications) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const slot = new Date(Math.floor(occurredAtMicrosOf(payload, context.jobName) / 1000));
    const purged = await this.purge.execute();
    this.logger.log(
      `Deleted ${purged.notices} notice(s), ${purged.cancellations} cancellation(s) and ` +
        `${purged.endedOrganizations} ended organization(s) past their retention, for the slot of ${slot.toISOString()}`,
    );
  }
}
