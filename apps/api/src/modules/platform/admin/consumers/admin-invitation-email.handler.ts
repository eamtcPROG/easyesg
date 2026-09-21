import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import type { AppConfig } from '@api/config/configuration';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NOTIFICATION_EMAIL_PORT, type NotificationEmailPort } from '@api/contracts/notification-email.port';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import {
  ADMIN_INVITATION_ISSUED,
  type AdminInvitationIssued,
} from '../constants/admin-invitation.constants';

/**
 * Sends the administrator invitation email (task 67.4; UC-87), on the worker, from the outbox — the
 * tenant `InvitationEmailHandler`'s shape over the admin realm, and its reasons for building the link
 * here rather than in the request tier.
 *
 * **The link points at the console, built from `ADMIN_ORIGIN`** — the origin the api's CORS and
 * Origin proof already name — never from a request header, since there is no request and a link built
 * from `Host` is a redirect-poisoning path. **The token is a path segment**, A-20's route
 * (`/invitation/$token`), for the tenant route's reason.
 *
 * **Romanian, always**: the console is Romanian-only (OQ-42) and an operator account holds no
 * language to resolve per recipient (FR-169), so the source locale is the one true answer rather than
 * a fallback.
 */
@Injectable()
@HandlesJob(ADMIN_INVITATION_ISSUED)
export class AdminInvitationEmailHandler implements JobHandler {
  constructor(
    @Inject(NOTIFICATION_EMAIL_PORT) private readonly email: NotificationEmailPort,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const event = readEvent(payload);

    const link = new URL(
      `/invitation/${encodeURIComponent(event.token)}`,
      this.config.get('admin.origin', { infer: true }),
    );

    await this.email.send({
      to: event.email,
      locale: SOURCE_LOCALE,
      categoryKey: NOTIFICATION_CATEGORY.ADMIN_INVITATION,
      params: { invitationUrl: link.toString() },
      // The outbox row's key, arriving as the job id — a redelivery sends the same message, a resend a
      // new one, since its key carries the new expiry.
      idempotencyKey: context.jobId,
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
