import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import type { NotificationRaised } from '../constants/notification.constants';
import type { EmailChannel } from '../interfaces/email-channel.interface';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '../models/notification-category.model';

/** The channel decision this use case asks for — `CategoryChannels`' shape, named so no framework class enters. */
export interface NotificationChannelDecision {
  channelsFor(query: { readonly categoryKey: NotificationCategoryKey }): readonly NotificationChannel[];
}

export interface DeliverNotificationCommand {
  readonly notice: NotificationRaised;
  /** The outbox row's key: the notice's id, and the stem of each message's idempotency key (§8.4). */
  readonly deliveryId: string;
}

export interface DeliverNotificationResult {
  /** Ids the producer named that resolve to no account — skipped, and the caller's to report. */
  readonly unresolved: readonly string[];
}

/**
 * UC-172 … UC-173: deliver a raised notice (task 49.3; AD-11, FR-157, FR-169).
 *
 * **The decisions of the flow live here, framework-free**, and the job handler only reads the payload and calls
 * this: the category's channels, by `CategoryChannels`' rule (which refuses in-app until 50.1 and answers an
 * unreadable behaviour by the category's kind); each recipient resolved from their account at send time, so
 * their address and language are the ones they hold now; the deep link made absolute in that language; and one
 * message per recipient keyed by the delivery and the user, so a re-driven job asks the provider for the same
 * messages rather than second copies.
 *
 * **An id naming no account is skipped, not fatal** — the other recipients are still owed their notice — and it
 * comes back as `unresolved` for the caller to say. What the recipients adapter does not check is membership or
 * account standing: the producer named the recipients, and is where that decision belongs.
 */
export class DeliverNotification {
  constructor(
    private readonly recipients: NotificationRecipientsPort,
    private readonly email: EmailChannel,
    private readonly channels: NotificationChannelDecision,
    /** `PUBLIC_WEB_URL`: the origin a deep link is made absolute against, never a request's `Host`. */
    private readonly webOrigin: string,
  ) {}

  async execute(command: DeliverNotificationCommand): Promise<DeliverNotificationResult> {
    const { notice } = command;
    const channels = this.channels.channelsFor({ categoryKey: notice.categoryKey });
    if (!channels.includes(NOTIFICATION_CHANNEL.EMAIL)) return { unresolved: [] };

    const found = await this.recipients.resolve({ userIds: notice.recipientUserIds });
    const unresolved = notice.recipientUserIds.filter((id) => !found.some((recipient) => recipient.userId === id));

    for (const recipient of found) {
      // The locale prefix always, the source locale included, for `VerificationEmailHandler`'s reason: `apps/web`
      // redirects the superfluous one, and teaching this module its routing would put a front-end rule here.
      const link = new URL(`/${recipient.locale}${notice.deepLink}`, this.webOrigin);
      await this.email.send({
        categoryKey: notice.categoryKey,
        to: recipient.email,
        locale: recipient.locale,
        // `link` is the placeholder a raised category's templates are written against (§12.5.6's task-49.3 row).
        params: { ...notice.params, link: link.toString() },
        idempotencyKey: `${command.deliveryId}:${recipient.userId}`,
      });
    }
    return { unresolved };
  }
}
