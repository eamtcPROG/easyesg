import { Inject, Injectable } from '@nestjs/common';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import {
  NOTICE_APPLICATION,
  NOTIFICATION_DELIVERY,
  type NotificationDeliveryPort,
} from '@api/contracts/notification-delivery.port';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { ADMIN_INVITATION_ISSUED, type AdminInvitationIssued } from '../constants/admin-invitation.constants';

/**
 * Sends the administrator invitation email (task 67.4; UC-87), on the worker, from the outbox — the
 * tenant `InvitationEmailHandler`'s shape over the admin realm, and its reasons for naming the link
 * here rather than in the request tier. Since task 50.1.4 it hands the notice to `NOTIFICATION_DELIVERY`,
 * which records it — a platform notice, under the reserved organization id, its link sealed and the
 * operator's address as its recipient (§12.5.6's task-50.1 rows (14) … (17)).
 *
 * **The link points at the console**, which the notification module makes absolute against
 * `ADMIN_ORIGIN` — the origin the api's CORS and Origin proof already name — never a request header,
 * with no language in its path. **The token is a path segment**, A-20's route (`/invitation/$token`),
 * for the tenant route's reason.
 *
 * **Romanian, always**: the console is Romanian-only (OQ-42) and an operator account holds no
 * language to resolve per recipient (FR-169), so the source locale is the one true answer rather than
 * a fallback.
 */
@Injectable()
@HandlesJob(ADMIN_INVITATION_ISSUED)
export class AdminInvitationEmailHandler implements JobHandler {
  constructor(@Inject(NOTIFICATION_DELIVERY) private readonly delivery: NotificationDeliveryPort) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const event = readEvent(payload);

    await this.delivery.deliver({
      // The outbox row's key, arriving as the job id — a redelivery sends nothing twice, a resend a new message,
      // since its key carries the new expiry.
      issuanceKey: context.jobId,
      occurredAtMicros: occurredAtMicrosOf(payload, ADMIN_INVITATION_ISSUED),
      categoryKey: NOTIFICATION_CATEGORY.ADMIN_INVITATION,
      recipient: { address: event.email, locale: SOURCE_LOCALE },
      application: NOTICE_APPLICATION.CONSOLE,
      deepLink: '/invitation',
      linkPath: `/invitation/${encodeURIComponent(event.token)}`,
      params: {},
    });
  }
}

/** Validates rather than asserts — the tenant handler's reason: a malformed row must fail visibly. */
function readEvent(payload: Record<string, unknown>): AdminInvitationIssued {
  const { invitationId, email, token } = payload;

  if (typeof invitationId !== 'string' || typeof email !== 'string' || typeof token !== 'string') {
    throw new Error(`${ADMIN_INVITATION_ISSUED} payload is missing a required field.`);
  }

  return { invitationId, email, token };
}
