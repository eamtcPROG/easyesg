import { Injectable, Logger } from '@nestjs/common';
import { isNotificationCategoryKey } from '@api/contracts/notification.port';
import { isUuid } from '@api/contracts/types/uuid';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { NOTIFICATION_RAISED, type NotificationRaised } from '../constants/notification.constants';
import { DeliverNotification } from '../use-cases/deliver-notification.use-case';

/**
 * Delivers a raised notice, on the worker, from the outbox (task 49.3; AD-10, AD-11, FR-157).
 *
 * The general case of the path verification email already takes — `NotificationPort.raise()` writes an outbox
 * row on the producer's transaction, the dispatcher enqueues it as `platform.notification.raised`, and
 * `OutboxConsumer` routes it here. **This is the adapter and nothing more**: it validates the payload and hands
 * it to `DeliverNotification`, where the flow's decisions live framework-free — recording the notice and each
 * delivery since task 50.1.1 — then says which recipients named no account.
 */
@Injectable()
@HandlesJob(NOTIFICATION_RAISED)
export class NotificationRaisedHandler implements JobHandler {
  private readonly logger = new Logger(NotificationRaisedHandler.name);

  constructor(private readonly deliver: DeliverNotification) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const { notice, organizationId, raisedAt } = readEvent(payload);
    const { unresolved } = await this.deliver.execute({ notice, organizationId, raisedAt, deliveryId: context.jobId });
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
 *
 * **The organization is the dispatcher's, not the producer's**: it travels on the job beside the payload the
 * outbox row carried, and it is what the store's every statement is bound to — so a value that is not a UUID is
 * refused here rather than reaching `app.current_org`, where the policies' cast would fail the job less legibly. **So
 * is the time** (task 50.1.3): the outbox row's, in epoch milliseconds, which orders the raise against a cancellation.
 */
function readEvent(payload: Record<string, unknown>): {
  readonly notice: NotificationRaised;
  readonly organizationId: string;
  readonly raisedAt: Date;
} {
  const { categoryKey, recipientUserIds, subjectRef, recipientScope, deepLink, params, organizationId, occurredAt } =
    payload;

  if (
    !isUuid(organizationId) ||
    typeof occurredAt !== 'number' ||
    !Number.isFinite(occurredAt) ||
    !isNotificationCategoryKey(categoryKey) ||
    !Array.isArray(recipientUserIds) ||
    !recipientUserIds.every((id) => typeof id === 'string') ||
    typeof subjectRef !== 'string' ||
    typeof recipientScope !== 'string' ||
    typeof deepLink !== 'string' ||
    !deepLink.startsWith('/') ||
    typeof params !== 'object' ||
    params === null ||
    Array.isArray(params)
  ) {
    throw new Error(`${NOTIFICATION_RAISED} payload is missing a required field or names no category.`);
  }

  return {
    notice: {
      categoryKey,
      recipientUserIds,
      subjectRef,
      recipientScope,
      deepLink,
      params: params as Record<string, unknown>,
    },
    organizationId,
    raisedAt: new Date(occurredAt),
  };
}
