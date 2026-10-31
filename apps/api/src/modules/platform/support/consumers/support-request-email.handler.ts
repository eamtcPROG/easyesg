import { Inject, Injectable, Logger } from '@nestjs/common';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import {
  NOTICE_APPLICATION,
  NOTIFICATION_DELIVERY,
  type NotificationDeliveryPort,
} from '@api/contracts/notification-delivery.port';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { SUPPORT_REQUEST_RECEIVED } from '../constants/support.constants';
import { supportSenderOrigin } from '../domain/support-sender-origin';
import { SUPPORT_CHANNEL_READER, type SupportChannelReader } from '../interfaces/support-channel-reader.interface';
import { SUPPORT_REQUEST_STORE, type SupportRequestStore } from '../interfaces/support-request-store.interface';

/**
 * Delivers a support request to the support address (task 77; FR-212 behaviour 3; `architecture.md` §12.5.6's task-77
 * row (1), (8)), on the worker, from the outbox row the request was recorded with — the admin invitation's shape: a
 * platform notice handed to `NOTIFICATION_DELIVERY`, recorded under the reserved organization, its recipient an address.
 *
 * **Romanian, always**: the address is the platform's own support mailbox, which holds no language to resolve, so the
 * source locale is the one true answer. **Its Reply-To is the reader's address**, so support answers by replying. **Its
 * button opens the console**, the support team's application: the request itself is in the message.
 *
 * **The address is read when the mail is sent**, so an edit published between the request and its mail takes effect;
 * with none readable the job fails and retries, rather than mailing nowhere. A request purged before its mail went —
 * a queue stalled for 24 months — is skipped, not fatal.
 */
@Injectable()
@HandlesJob(SUPPORT_REQUEST_RECEIVED)
export class SupportRequestEmailHandler implements JobHandler {
  private readonly logger = new Logger(SupportRequestEmailHandler.name);

  constructor(
    @Inject(SUPPORT_REQUEST_STORE) private readonly store: SupportRequestStore,
    @Inject(SUPPORT_CHANNEL_READER) private readonly channel: SupportChannelReader,
    @Inject(NOTIFICATION_DELIVERY) private readonly delivery: NotificationDeliveryPort,
  ) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const request = await this.store.read({ id: readRequestId(payload) });
    if (request === null) {
      this.logger.warn(`${context.jobId}: the support request was purged before its mail went; nothing was sent`);
      return;
    }
    const channel = this.channel.inForce();
    if (channel === null) throw new Error('No support address is in force; the request is mailed once one is');

    await this.delivery.deliver({
      issuanceKey: context.jobId,
      occurredAtMicros: occurredAtMicrosOf(payload, SUPPORT_REQUEST_RECEIVED),
      categoryKey: NOTIFICATION_CATEGORY.SUPPORT_REQUEST,
      recipient: { address: channel.address, locale: SOURCE_LOCALE },
      replyTo: request.sender.email,
      application: NOTICE_APPLICATION.CONSOLE,
      deepLink: '/',
      linkPath: '/',
      params: {
        reference: request.reference,
        senderName: request.sender.name,
        senderEmail: request.sender.email,
        senderOrigin: supportSenderOrigin(request.sender),
        organizationName: request.sender.organizationName ?? '',
        topic: request.topic,
        replyLocale: request.replyLocale,
        question: request.question,
      },
    });
  }
}

/** Validates rather than asserts — a malformed row must fail visibly, the tenant handlers' reason. */
function readRequestId(payload: Record<string, unknown>): string {
  if (typeof payload.requestId !== 'string') {
    throw new Error(`${SUPPORT_REQUEST_RECEIVED} payload is missing its requestId.`);
  }
  return payload.requestId;
}
