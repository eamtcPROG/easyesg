import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toLocale } from '@easyesg/i18n';
import type { AppConfig } from '@api/config/configuration';
import { EMAIL_PORT, type EmailPort } from '@api/contracts/email.port';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import {
  INVITATION_ISSUED,
  INVITATION_TEMPLATE,
  type InvitationIssued,
} from '../constants/invitation.constants';

/**
 * Sends the invitation email (FR-11, FR-57), on the worker, from the outbox (AD-6, AD-10).
 *
 * The far end of the chain UC-60 starts: `IssueInvitation` writes an outbox row in the same
 * transaction as the invitation, the dispatcher enqueues it as a job named
 * `identity.invitation.issued`, and `OutboxConsumer` routes it here by that name. Nothing in the
 * request tier ever calls `EmailPort`.
 *
 * **One handler for issue and resend alike**, because the recipient sees one kind of message with a
 * different link in it. A second event type would be a second template and a second thing to keep
 * in step for a distinction nobody outside the code can observe.
 *
 * It is an adapter, not a use case, and has no use case behind it on purpose: there is no domain
 * decision here. It reads a payload, builds a URL and calls a port — `VerificationEmailHandler`
 * carries the same reasoning at length.
 *
 * **The link is built here** for that handler's two reasons: its shape is `apps/web`'s route table
 * and its origin is deployment configuration, neither of which the compliance core should know; and
 * the origin comes from `PUBLIC_WEB_URL` rather than a request header, because there is no request
 * and a link built from `Host` is a textbook redirect-poisoning path.
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
  constructor(
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const event = readEvent(payload);

    // `URL` rather than string concatenation: it is what keeps a trailing slash on PUBLIC_WEB_URL
    // from producing `//ro/invitation/…`. The token is base64url, which is URL-safe by
    // construction — encoding it again costs nothing and means the path stays correct if the
    // token encoding ever changes.
    //
    // The locale is always prefixed, including the source locale, for the reason
    // `VerificationEmailHandler` records: `apps/web` serves Romanian unprefixed since 21 Aug 2026,
    // so a `ro` link is 307-redirected with the path preserved, and teaching this handler which
    // locale takes no prefix would duplicate a front-end routing decision inside the compliance
    // core where it could go stale invisibly.
    const link = new URL(
      `/${event.locale}/invitation/${encodeURIComponent(event.token)}`,
      this.config.get('web.publicUrl', { infer: true }),
    );

    await this.email.send({
      to: event.email,
      locale: event.locale,
      templateKey: INVITATION_TEMPLATE,
      params: { organizationName: event.organizationName, invitationUrl: link.toString() },
      // §8.4's idempotency key, generated in the originating transaction — it is the outbox row's
      // key, arriving here as the job id. A redelivered job therefore asks the provider to send the
      // same message rather than a second one, while a genuine resend carries a different key
      // because the invitation's expiry moved with it.
      idempotencyKey: context.jobId,
    });
  }
}

/**
 * Validates the payload rather than asserting over it.
 *
 * The row was written by this application, so a malformed one means something is genuinely wrong —
 * a renamed field, a hand-inserted row, a payload from an older release still in the queue. A blind
 * cast would send an email to `undefined` and log a success; throwing puts the job in the failed set
 * with the reason attached.
 */
function readEvent(payload: Record<string, unknown>): InvitationIssued {
  const { invitationId, organizationName, email, locale, token } = payload;

  if (
    typeof invitationId !== 'string' ||
    typeof organizationName !== 'string' ||
    typeof email !== 'string' ||
    typeof token !== 'string' ||
    typeof locale !== 'string'
  ) {
    throw new Error(`${INVITATION_ISSUED} payload is missing a required field.`);
  }

  return {
    invitationId,
    organizationName,
    email,
    token,
    locale: toLocale(locale),
  };
}
