import { Injectable } from '@nestjs/common';
import { isNotificationCategoryKey } from '@api/contracts/notification.port';
import { isUuid } from '@api/contracts/types/uuid';
import { HandlesJob, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { NOTIFICATION_CANCELLED } from '../constants/notification.constants';
import type { CancelNoticeCommand } from '../interfaces/notification-cancellation-store.interface';
import { CancelNotification } from '../use-cases/cancel-notification.use-case';

/**
 * Applies a withdrawn notice, on the worker, from the outbox (task 50.1.3; FR-167; AD-10).
 *
 * `NotificationPort.cancel()` writes an outbox row on the producer's transaction, the dispatcher enqueues it as
 * `platform.notification.cancelled`, and this hands it to `CancelNotification`. **The adapter and nothing more**,
 * as `NotificationRaisedHandler` is: it validates the payload and the two facts the dispatcher puts beside it — the
 * organization the store binds to, and the row's time, which is what orders this cancellation against its key's
 * raises (§12.5.6's task-50.1 row (12)).
 */
@Injectable()
@HandlesJob(NOTIFICATION_CANCELLED)
export class NotificationCancelledHandler implements JobHandler {
  constructor(private readonly cancelNotification: CancelNotification) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    await this.cancelNotification.execute(readEvent(payload));
  }
}

/** Validated rather than asserted over, `NotificationRaisedHandler.readEvent`'s argument. */
function readEvent(payload: Record<string, unknown>): CancelNoticeCommand {
  const { categoryKey, subjectRef, recipientScope, organizationId, occurredAt } = payload;

  if (
    !isUuid(organizationId) ||
    !isNotificationCategoryKey(categoryKey) ||
    typeof subjectRef !== 'string' ||
    typeof recipientScope !== 'string' ||
    typeof occurredAt !== 'number' ||
    !Number.isFinite(occurredAt)
  ) {
    throw new Error(`${NOTIFICATION_CANCELLED} payload is missing a required field or names no category.`);
  }

  return { organizationId, categoryKey, subjectRef, recipientScope, cancelledAt: new Date(occurredAt) };
}
