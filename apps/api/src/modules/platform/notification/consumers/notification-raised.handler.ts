import { Injectable, Logger } from '@nestjs/common';
import { isNotificationCategoryKey } from '@api/contracts/notification.port';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { NOTIFICATION_RAISED, type NotificationRaised } from '../constants/notification.constants';
import { DeliverNotification } from '../use-cases/deliver-notification.use-case';

/**
 * Delivers a raised notice, on the worker, from the outbox (task 49.3; AD-10, AD-11, FR-157).
 *
 * The general case of the path verification email already takes — `NotificationPort.raise()` writes an outbox
 * row on the producer's transaction, the dispatcher enqueues it as `platform.notification.raised`, and
 * `OutboxConsumer` routes it here. **This is the adapter and nothing more**: it validates the payload and hands
 * it to `DeliverNotification`, where the flow's decisions live framework-free, then says which recipients named
 * no account.
 */
@Injectable()
@HandlesJob(NOTIFICATION_RAISED)
export class NotificationRaisedHandler implements JobHandler {
  private readonly logger = new Logger(NotificationRaisedHandler.name);

  constructor(private readonly deliver: DeliverNotification) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const { unresolved } = await this.deliver.execute({ notice: readEvent(payload), deliveryId: context.jobId });
    if (unresolved.length > 0) {
      this.logger.warn(
        `${NOTIFICATION_RAISED} ${context.jobId}: ${unresolved.length} recipient(s) name no account and were skipped`,
      );
    }
  }
}

/**
 * Validates the payload rather than asserting over it — `VerificationEmailHandler.readEvent`'s argument: the row
 * was written by this application, so a malformed one is a genuine fault, and throwing puts the job in the
 * failed set with the reason rather than sending to `undefined`.
 */
function readEvent(payload: Record<string, unknown>): NotificationRaised {
  const { categoryKey, recipientUserIds, subjectRef, deepLink, params } = payload;

  if (
    !isNotificationCategoryKey(categoryKey) ||
    !Array.isArray(recipientUserIds) ||
    !recipientUserIds.every((id) => typeof id === 'string') ||
    typeof subjectRef !== 'string' ||
    typeof deepLink !== 'string' ||
    !deepLink.startsWith('/') ||
    typeof params !== 'object' ||
    params === null ||
    Array.isArray(params)
  ) {
    throw new Error(`${NOTIFICATION_RAISED} payload is missing a required field or names no category.`);
  }

  return {
    categoryKey,
    recipientUserIds,
    subjectRef,
    deepLink,
    params: params as Record<string, unknown>,
  };
}
