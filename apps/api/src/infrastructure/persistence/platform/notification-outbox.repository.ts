import { Injectable } from '@nestjs/common';
import type { NotificationPort, RaiseNotificationCommand } from '@api/contracts/notification.port';
import {
  NOTIFICATION_RAISED,
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
 * record 50.1 adds adopts it. The payload carries what the producer named and no address (row (4)).
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
}
