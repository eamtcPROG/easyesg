import { NOTICE_APPLICATION } from '@api/contracts/notification-delivery.port';
import type { NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import type { EpochMicros } from '@api/contracts/types/time';
import type { NotificationRaised } from '../constants/notification.constants';
import { noticeLink } from '../domain/notice-link';
import { stillOwed } from '../domain/still-owed';
import type { EmailChannel } from '../interfaces/email-channel.interface';
import type { NotificationChannelDecision } from '../interfaces/notification-channel-decision.interface';
import type { NotificationStore } from '../interfaces/notification-store.interface';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../models/notification-category.model';
import { NOTIFICATION_STATE } from '../models/notification-record.model';

export interface DeliverNotificationCommand {
  readonly notice: NotificationRaised;
  /** The organization the notice was raised in, which every statement against the store is bound to. */
  readonly organizationId: string;
  /** The outbox row's key: the id a new notice adopts (§12.5.6's task-49.3 row (3)). */
  readonly deliveryId: string;
  /** The outbox row's time, which orders this raise against its key's cancellation (§12.5.6's task-50.1 row (12)). */
  readonly raisedAtMicros: EpochMicros;
}

export interface DeliverNotificationResult {
  /** Ids the producer named that resolve to no account — skipped, and the caller's to report. */
  readonly unresolved: readonly string[];
}

/**
 * UC-172 … UC-174: deliver a raised notice, and record that it was (tasks 49.3, 50.1.1; AD-11, FR-157, FR-160,
 * FR-167 … FR-170).
 *
 * **The decisions of the flow live here, framework-free**, and the job handler only reads the payload and calls
 * this. In order:
 *
 * 1. **The category's channels**, by `CategoryChannels`' rule — an unreadable behaviour is answered by the
 *    category's kind, and a refusal fails the job before anything is recorded.
 * 2. **Each recipient resolved from their account now**, so their address and language are the ones they hold at
 *    the send. An id naming no account is skipped, not fatal, and comes back as `unresolved`. Membership and
 *    standing are not checked: the producer named the recipients, and is where that decision belongs.
 * 3. **The notice opened in the store** — found by its own id when the job is a redelivery, folded into the open
 *    notice for the same key (FR-167), or recorded under this raise's id. A cancelled notice delivers nothing more,
 *    and nor does a raise its key's cancellation came after (task 50.1.3), whichever the workers took first.
 *    **What is delivered is the notice as recorded**: a folded raise adds recipients, and they receive what the
 *    others received.
 * 4. **In-app first, then email**, each only to whom the notice still owes on that channel — so the centre fills
 *    with no provider in the path (FR-168), and a provider failure fails the job with in-app already done. An email
 *    is recorded once the provider accepts it (row (7)); its key is the notice and the recipient, so a job run again
 *    after a crash between the two asks the provider for the same message rather than a second.
 * 5. **The notice marked delivered**, once its dispatch has finished.
 */
export class DeliverNotification {
  constructor(
    private readonly recipients: NotificationRecipientsPort,
    private readonly email: EmailChannel,
    private readonly channels: NotificationChannelDecision,
    private readonly store: NotificationStore,
    /** `PUBLIC_WEB_URL`: the origin a deep link is made absolute against, never a request's `Host`. */
    private readonly webOrigin: string,
  ) {}

  async execute(command: DeliverNotificationCommand): Promise<DeliverNotificationResult> {
    const { notice, organizationId } = command;
    const channels = this.channels.channelsFor({ categoryKey: notice.categoryKey });

    const found = await this.recipients.resolve({ userIds: notice.recipientUserIds });
    const unresolved = notice.recipientUserIds.filter((id) => !found.some((recipient) => recipient.userId === id));

    const record = await this.store.open({
      notificationId: command.deliveryId,
      organizationId,
      categoryKey: notice.categoryKey,
      subjectRef: notice.subjectRef,
      recipientScope: notice.recipientScope,
      raisedAtMicros: command.raisedAtMicros,
      deepLink: notice.deepLink,
      // Every raised notice opens the tenant application: its producers are the tenant tier's, and the origin this
      // flow makes links absolute against is `PUBLIC_WEB_URL` (task 165).
      application: NOTICE_APPLICATION.WEB,
      params: notice.params,
    });
    if (record.state === NOTIFICATION_STATE.CANCELLED) return { unresolved };

    const ref = { notificationId: record.notificationId, organizationId };
    const owed = (channel: NotificationChannel) =>
      channels.includes(channel) ? stillOwed({ recipients: found, channel, delivered: record.delivered }) : [];

    const inApp = owed(NOTIFICATION_CHANNEL.IN_APP);
    if (inApp.length > 0) {
      await this.store.deliverInApp({ ...ref, recipientIds: inApp.map((recipient) => recipient.userId) });
    }

    for (const recipient of owed(NOTIFICATION_CHANNEL.EMAIL)) {
      const link = noticeLink({ origin: this.webOrigin, path: record.deepLink, locale: recipient.locale });
      await this.email.send({
        categoryKey: notice.categoryKey,
        to: recipient.email,
        locale: recipient.locale,
        // `link` is the placeholder a raised category's templates are written against (§12.5.6's task-49.3 row).
        params: { ...record.params, link },
        idempotencyKey: `${record.notificationId}:${recipient.userId}`,
      });
      await this.store.recordEmailAccepted({ ...ref, recipient: { accountId: recipient.userId } });
    }

    await this.store.markDelivered(ref);
    return { unresolved };
  }
}
