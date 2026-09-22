import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import {
  NOTICE_APPLICATION,
  NOTIFICATION_DELIVERY,
  type NotificationDeliveryPort,
} from '@api/contracts/notification-delivery.port';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import {
  EMAIL_VERIFICATION_REQUESTED,
  type EmailVerificationRequested,
} from '../constants/account.constants';

/**
 * Sends the verification email (FR-3), on the worker, from the outbox (AD-6, AD-10).
 *
 * This is the far end of the chain registration starts: `RegisterAccount` writes an outbox row in
 * the same transaction as the account, the dispatcher enqueues it as a job named
 * `identity.email_verification.requested`, and `OutboxConsumer` routes it here by that name.
 * Nothing in the request tier ever sends mail, and nothing here reaches the provider either: since
 * task 50.1.4 the notice goes to `NOTIFICATION_DELIVERY`, which records it and its delivery (FR-170)
 * and sends it through the notification module's one email channel (AD-11; §12.5.6's task-50.1 row
 * (14)).
 *
 * It is an adapter, not a use case, and has no use case behind it on purpose: there is no domain
 * decision here. It reads a payload, names the link and hands the notice over. A `SendVerificationEmail`
 * class in `use-cases/` would be the thin pass-through CLAUDE.md warns against — orchestration with
 * nothing to orchestrate.
 *
 * **The link's path is named here**, because its shape is `apps/web`'s route table, which the
 * notification module should not know; the module makes it absolute against `PUBLIC_WEB_URL` —
 * never a request header: there is no request, and a link built from `Host` is a textbook
 * redirect-poisoning path — prefixed with the recipient's language. It prefixes the source locale
 * too, and that is deliberate: `apps/web` serves Romanian unprefixed (architecture.md §10.8), so a
 * `ro` link lands on `/ro/verify` and is `307`-redirected with the query preserved. The redirect is
 * harmless to the mail-scanner defence: the token is consumed by an explicit POST, never by opening
 * the URL.
 *
 * **Two paths, one with the token and one without** (row (15)): the notice keeps the link it sent
 * sealed, and its `/verify` in the clear. The recipient is the account, resolved when the email is
 * sent, so the address and language are the ones it holds then (row (16)).
 */
@Injectable()
@HandlesJob(EMAIL_VERIFICATION_REQUESTED)
export class VerificationEmailHandler implements JobHandler {
  constructor(@Inject(NOTIFICATION_DELIVERY) private readonly delivery: NotificationDeliveryPort) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const event = readEvent(payload);

    await this.delivery.deliver({
      // §8.4's idempotency key, generated in the originating transaction — the outbox row's key, arriving
      // as the job id. A redelivered job finds its notice and sends nothing twice.
      issuanceKey: context.jobId,
      occurredAtMicros: occurredAtMicrosOf(payload, EMAIL_VERIFICATION_REQUESTED),
      categoryKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION,
      recipient: { accountId: event.accountId },
      application: NOTICE_APPLICATION.WEB,
      deepLink: '/verify',
      // The token is base64url and URL-safe; `URLSearchParams` encodes it anyway, so the path stays correct if
      // the encoding ever changes.
      linkPath: `/verify?${new URLSearchParams({ token: event.token }).toString()}`,
      params: {},
    });
  }
}

/**
 * Validates the payload rather than asserting over it.
 *
 * The row was written by this application, so a malformed one means something is genuinely wrong —
 * a renamed field, a hand-inserted row, a payload from an older release still in the queue. A blind
 * cast would send an email to `undefined` and log a success; throwing puts the job in the failed
 * set with the reason attached.
 */
function readEvent(payload: Record<string, unknown>): Pick<EmailVerificationRequested, 'accountId' | 'token'> {
  const { accountId, token } = payload;

  if (typeof accountId !== 'string' || typeof token !== 'string') {
    throw new Error(`${EMAIL_VERIFICATION_REQUESTED} payload is missing a required field.`);
  }

  return { accountId, token };
}
