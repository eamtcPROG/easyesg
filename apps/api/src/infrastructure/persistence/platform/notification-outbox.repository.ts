import { Injectable } from '@nestjs/common';
import type {
  CancelNotificationCommand,
  NotificationPort,
  RaiseNotificationCommand,
} from '@api/contracts/notification.port';
import {
  DEFAULT_RECIPIENT_SCOPE,
  NOTIFICATION_CANCELLED,
  NOTIFICATION_RAISED,
  type NotificationCancelled,
  type NotificationRaised,
} from '@api/modules/platform/notification/constants/notification.constants';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { TenantRepository } from '../tenant-repository';

/**
 * `NotificationPort.raise()` — an outbox row **on the producer's own request transaction** (task 49.3; P-8, AD-6;
 * §12.5.6's task-49.3 row (3)).
 *
 * A `TenantRepository` for its runner and nothing else: the notice commits with the decision that raised it or
 * not at all, which is the guarantee a separate transaction would quietly give up. Called with no request
 * transaction — a producer on the worker — it throws `TenantContextMissingError` rather than writing on a second
 * one; 51.2's schedules decide where theirs comes from.
 *
 * **The notice's id is the outbox row's key**, generated here in the originating transaction (AD-6), and the
 * record task 50.1.1 writes on the worker adopts it. The payload carries what the producer named, its audience
 * resolved to the default when it named none, and no address (row (4)).
 */
@Injectable()
export class NotificationOutboxRepository extends TenantRepository<never> implements NotificationPort {
  protected readonly entity = 'audit.outbox_event' as never;

  async raise(command: RaiseNotificationCommand): Promise<{ notificationId: string }> {
    // A notice to nobody is a producer's defect, and it would otherwise travel all the way to the worker to
    // deliver nothing.
    if (command.recipientUserIds.length === 0) {
      throw new Error(`A ${command.categoryKey} notification names no recipient.`);
    }

    const payload: NotificationRaised = {
      categoryKey: command.categoryKey,
      recipientUserIds: command.recipientUserIds,
      subjectRef: command.subjectRef,
      recipientScope: command.recipientScope ?? DEFAULT_RECIPIENT_SCOPE,
      deepLink: command.deepLink,
      params: command.params ?? {},
    };
    const notificationId = await writeOutboxEvent(this.runner, {
      eventType: NOTIFICATION_RAISED,
      payload: { ...payload },
      organizationId: command.organizationId,
    });
    return { notificationId };
  }

  /**
   * FR-167's withdrawal — an outbox row on the same request transaction, for `raise()`'s reason (task 50.1.3). The
   * payload is the key, with the audience resolved to the default as `raise()` resolves it, so the two name one
   * key whichever the producer spelled out.
   */
  async cancel(command: CancelNotificationCommand): Promise<void> {
    const payload: NotificationCancelled = {
      categoryKey: command.categoryKey,
      subjectRef: command.subjectRef,
      recipientScope: command.recipientScope ?? DEFAULT_RECIPIENT_SCOPE,
    };
    await writeOutboxEvent(this.runner, {
      eventType: NOTIFICATION_CANCELLED,
      payload: { ...payload },
      organizationId: command.organizationId,
    });
  }
}
