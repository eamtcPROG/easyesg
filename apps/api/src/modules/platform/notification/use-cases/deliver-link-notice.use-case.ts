import type { Locale } from '@easyesg/i18n';
import {
  NOTICE_APPLICATION,
  type DeliverNoticeCommand,
  type NoticeApplication,
} from '@api/contracts/notification-delivery.port';
import type { NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { DEFAULT_RECIPIENT_SCOPE } from '../constants/notification.constants';
import { noticeIdFor } from '../domain/notice-id';
import { noticeLink } from '../domain/notice-link';
import type { EmailChannel } from '../interfaces/email-channel.interface';
import type { NotificationChannelDecision } from '../interfaces/notification-channel-decision.interface';
import type { NotificationStore, RecordedRecipient } from '../interfaces/notification-store.interface';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import { NOTIFICATION_STATE, PLATFORM_ORGANIZATION_ID } from '../models/notification-record.model';

/**
 * What of the store this flow uses — never an in-app delivery, which is what makes row (20)'s *email, never in-app*
 * structural rather than a branch someone could add (`di-interface-segregation`).
 */
export type LinkNoticeStore = Pick<NotificationStore, 'open' | 'recordEmailAccepted' | 'markDelivered'>;

/** Why a notice was not sent — each the caller's to say, none a failure of the job. */
export const LINK_NOTICE_SKIP = {
  /** The account it was addressed to no longer exists. */
  ACCOUNT_GONE: 'account_gone',
  /** The category's published channels name no email — A-17's to refuse, and obeyed until it does. */
  NOT_BY_EMAIL: 'not_by_email',
} as const;

export type LinkNoticeSkip = (typeof LINK_NOTICE_SKIP)[keyof typeof LINK_NOTICE_SKIP];

export interface DeliverLinkNoticeResult {
  readonly skipped: LinkNoticeSkip | null;
}

/**
 * UC-173 and UC-174 for a notice delivered from its producer's own event — one whose producer held no request
 * transaction and whose link carries a token (task 50.1.4; FR-169, FR-170; §12.5.6's task-50.1 rows (14) … (20)).
 *
 * **`DeliverNotification`'s flow, for one recipient and a link its handler named**, framework-free like it:
 *
 * 1. **Email, and never in-app** (row (20)): a notice carrying a token has no use in a centre, so an in-app channel is
 *    ignored — a category published with one still sends its email. A category whose channels name no email sends
 *    nothing, and says so; refusing that publication is A-17's (task 67.10).
 * 2. **The recipient**: an account resolved now, its address and language as they stand (FR-169); an address as the
 *    handler named it. An account that no longer exists is skipped, not fatal.
 * 3. **The link made absolute** by `noticeLink`, the rule `DeliverNotification` applies — prefixed with the
 *    recipient's language in the tenant application, and with none on the console.
 * 4. **The notice opened** under the name-based id of its issuance's key, its subject that key — so each issuance
 *    is a notice and a redelivered job finds its own — in the organization it belongs to, or row (17)'s reserved id.
 *    The link it sends goes to the store to be kept sealed; the path with no token is kept in the clear.
 * 5. **The email**, unless this issuance's is already recorded, keyed by the issuance as the handlers always keyed
 *    it; then recorded as accepted, and the notice marked delivered.
 */
export class DeliverLinkNotice {
  constructor(
    private readonly recipients: NotificationRecipientsPort,
    private readonly email: EmailChannel,
    private readonly channels: NotificationChannelDecision,
    private readonly store: LinkNoticeStore,
    private readonly origins: { readonly [application in NoticeApplication]: string },
  ) {}

  async execute(command: DeliverNoticeCommand): Promise<DeliverLinkNoticeResult> {
    const channels = this.channels.channelsFor({ categoryKey: command.categoryKey });
    if (!channels.includes(NOTIFICATION_CHANNEL.EMAIL)) return { skipped: LINK_NOTICE_SKIP.NOT_BY_EMAIL };

    const recipient = await this.resolve(command);
    if (recipient === null) return { skipped: LINK_NOTICE_SKIP.ACCOUNT_GONE };

    const link = noticeLink({
      origin: this.origins[command.application],
      path: command.linkPath,
      locale: command.application === NOTICE_APPLICATION.WEB ? recipient.locale : null,
    });
    const ref = {
      notificationId: noticeIdFor(command.issuanceKey),
      organizationId: command.organizationId ?? PLATFORM_ORGANIZATION_ID,
    };
    const record = await this.store.open({
      ...ref,
      categoryKey: command.categoryKey,
      subjectRef: command.issuanceKey,
      recipientScope: DEFAULT_RECIPIENT_SCOPE,
      raisedAtMicros: command.occurredAtMicros,
      deepLink: command.deepLink,
      application: command.application,
      params: command.params,
      sealedLink: link,
    });
    if (record.state === NOTIFICATION_STATE.CANCELLED) return { skipped: null };

    if (!record.delivered.some((delivery) => delivery.channel === NOTIFICATION_CHANNEL.EMAIL)) {
      // Task 51.4: accepted, bounced or suppressed. A verification link to a dead mailbox is recorded as
      // refused rather than as sent, which is what lets support tell those two apart.
      const { outcome } = await this.email.send({
        categoryKey: command.categoryKey,
        ...(command.templateKey === undefined ? {} : { templateKey: command.templateKey }),
        to: recipient.address,
        locale: recipient.locale,
        params: { ...command.params, link },
        idempotencyKey: command.issuanceKey,
      });
      await this.store.recordEmailAccepted({ ...ref, recipient: recipient.recorded, outcome });
    }
    await this.store.markDelivered(ref);
    return { skipped: null };
  }

  private async resolve(command: DeliverNoticeCommand): Promise<{
    readonly address: string;
    readonly locale: Locale;
    readonly recorded: RecordedRecipient;
  } | null> {
    if ('address' in command.recipient) {
      const { address, locale } = command.recipient;
      return { address, locale, recorded: { address } };
    }
    const [account] = await this.recipients.resolve({ userIds: [command.recipient.accountId] });
    return account === undefined
      ? null
      : { address: account.email, locale: account.locale, recorded: { accountId: account.userId } };
  }
}
