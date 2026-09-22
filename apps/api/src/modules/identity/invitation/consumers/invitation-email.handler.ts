import { Inject, Injectable } from '@nestjs/common';
import { toLocale } from '@easyesg/i18n';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import {
  NOTICE_APPLICATION,
  NOTIFICATION_DELIVERY,
  type NotificationDeliveryPort,
} from '@api/contracts/notification-delivery.port';
import { isUuid } from '@api/contracts/types/uuid';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { INVITATION_ISSUED, type InvitationIssued } from '../constants/invitation.constants';

/**
 * Sends the invitation email (FR-11, FR-57), on the worker, from the outbox (AD-6, AD-10).
 *
 * The far end of the chain UC-60 starts: `IssueInvitation` writes an outbox row in the same
 * transaction as the invitation, the dispatcher enqueues it as a job named
 * `identity.invitation.issued`, and `OutboxConsumer` routes it here by that name. Nothing in the
 * request tier ever sends mail, and since task 50.1.4 this hands the notice to `NOTIFICATION_DELIVERY`,
 * which records it — the link it sent sealed, the invitee's address as its recipient — and sends it through the
 * notification module's one email channel (AD-11; §12.5.6's task-50.1 rows (14) … (16)).
 *
 * **One handler for issue and resend alike**, because the recipient sees one kind of message with a
 * different link in it. A second event type would be a second template and a second thing to keep
 * in step for a distinction nobody outside the code can observe.
 *
 * It is an adapter, not a use case, and has no use case behind it on purpose: there is no domain
 * decision here. It reads a payload, names the link and hands the notice over — `VerificationEmailHandler`
 * carries the same reasoning at length.
 *
 * **The link's path is named here** for that handler's reason: its shape is `apps/web`'s route table,
 * which the notification module should not know. The module makes it absolute against `PUBLIC_WEB_URL`,
 * never a request header. **The recipient is an address and a language** — the invitee may hold no
 * account, and the language was resolved at issue and stored — and the notice belongs to the inviting
 * organization, which the dispatcher carries beside the payload.
 *
 * **The token is a path segment, not a query parameter**, and that is `apps/web`'s route table
 * rather than a choice made here: `[locale]/(identity)/invitation/[token]` has existed since task 4
 * and task 26.3 is what renders it. It is why the value is `encodeURIComponent`-ed explicitly —
 * `searchParams` would have done it, and a path segment has no such helper.
 *
 * **`esg_worker` holds no grant on `identity.invitation`** (task 26.1), so everything this needs is
 * in the payload — including the organization's name, which no cross-tenant read would give it.
 */
@Injectable()
@HandlesJob(INVITATION_ISSUED)
export class InvitationEmailHandler implements JobHandler {
  constructor(@Inject(NOTIFICATION_DELIVERY) private readonly delivery: NotificationDeliveryPort) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const { event, organizationId } = readEvent(payload);

    await this.delivery.deliver({
      // The outbox row's key, arriving as the job id: a redelivered job finds its notice and sends nothing twice,
      // while a genuine resend carries a different key because the invitation's expiry moved with it.
      issuanceKey: context.jobId,
      occurredAtMicros: occurredAtMicrosOf(payload, INVITATION_ISSUED),
      organizationId,
      categoryKey: NOTIFICATION_CATEGORY.INVITATION,
      recipient: { address: event.email, locale: event.locale },
      application: NOTICE_APPLICATION.WEB,
      deepLink: '/invitation',
      linkPath: `/invitation/${encodeURIComponent(event.token)}`,
      params: { organizationName: event.organizationName },
    });
  }
}

/**
 * Validates the payload rather than asserting over it.
 *
 * The row was written by this application, so a malformed one means something is genuinely wrong —
 * a renamed field, a hand-inserted row, a payload from an older release still in the queue. A blind
 * cast would send an email to `undefined` and log a success; throwing puts the job in the failed set
 * with the reason attached. **The organization is the dispatcher's**, beside the payload, and an
 * invitation always has one.
 */
function readEvent(payload: Record<string, unknown>): {
  readonly event: InvitationIssued;
  readonly organizationId: string;
} {
  const { invitationId, organizationName, email, locale, token, organizationId } = payload;

  if (
    typeof invitationId !== 'string' ||
    typeof organizationName !== 'string' ||
    typeof email !== 'string' ||
    typeof token !== 'string' ||
    typeof locale !== 'string' ||
    !isUuid(organizationId)
  ) {
    throw new Error(`${INVITATION_ISSUED} payload is missing a required field.`);
  }

  return {
    event: { invitationId, organizationName, email, token, locale: toLocale(locale) },
    organizationId,
  };
}
