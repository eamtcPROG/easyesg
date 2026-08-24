import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toLocale } from '@easyesg/i18n';
import type { AppConfig } from '@api/config/configuration';
import { EMAIL_PORT, type EmailPort } from '@api/contracts/email.port';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import {
  EMAIL_VERIFICATION_REQUESTED,
  EMAIL_VERIFICATION_TEMPLATE,
  type EmailVerificationRequested,
} from '../constants/account.constants';

/**
 * Sends the verification email (FR-3), on the worker, from the outbox (AD-6, AD-10).
 *
 * This is the far end of the chain registration starts: `RegisterAccount` writes an outbox row in
 * the same transaction as the account, the dispatcher enqueues it as a job named
 * `identity.email_verification.requested`, and `OutboxConsumer` routes it here by that name.
 * Nothing in the request tier ever calls `EmailPort`.
 *
 * It is an adapter, not a use case, and has no use case behind it on purpose: there is no domain
 * decision here. It reads a payload, builds a URL and calls a port. A `SendVerificationEmail` class
 * in `use-cases/` would be the thin pass-through CLAUDE.md warns against — orchestration with
 * nothing to orchestrate.
 *
 * **The link is built here rather than by the use case**, because its shape is `apps/web`'s route
 * table and its origin is deployment configuration — neither of which the compliance core should
 * know. It is also why the origin comes from `PUBLIC_WEB_URL` and never from a request header:
 * there is no request, and a link built from `Host` is a textbook redirect-poisoning path.
 *
 * **It always prefixes the locale, including the source locale, and that is deliberate.** Since
 * 21 Aug 2026 `apps/web` serves Romanian unprefixed (architecture.md §10.8), so a `ro` link lands
 * on `/ro/verify` and is `307`-redirected to `/verify` with the query preserved — verified, and
 * next-intl's documented behaviour for a superfluous prefix. Teaching this handler which locale
 * takes no prefix would duplicate a front-end routing decision inside the compliance core, where
 * it could go stale invisibly; one redirect on a link each account follows once is the cheaper
 * side of that trade. The redirect is also harmless to the mail-scanner defence: the token is
 * consumed by an explicit POST, never by opening the URL.
 */
@Injectable()
@HandlesJob(EMAIL_VERIFICATION_REQUESTED)
export class VerificationEmailHandler implements JobHandler {
  constructor(
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const event = readEvent(payload);

    // `URL` rather than string concatenation: it encodes the token for us, and it is what keeps a
    // trailing slash on PUBLIC_WEB_URL from producing `//ro/verify`. The token is base64url, which
    // is URL-safe by construction — `searchParams` encoding it again costs nothing and means the
    // path stays correct if the encoding ever changes.
    const link = new URL(
      `/${event.locale}/verify`,
      this.config.get('web.publicUrl', { infer: true }),
    );
    link.searchParams.set('token', event.token);

    await this.email.send({
      to: event.email,
      locale: event.locale,
      templateKey: EMAIL_VERIFICATION_TEMPLATE,
      params: { verificationUrl: link.toString() },
      // §8.4's idempotency key, generated in the originating transaction — it is the outbox row's
      // key, arriving here as the job id. A redelivered job therefore asks the provider to send
      // the same message rather than a second one.
      idempotencyKey: context.jobId,
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
function readEvent(payload: Record<string, unknown>): EmailVerificationRequested {
  const { accountId, email, locale, token } = payload;

  if (
    typeof accountId !== 'string' ||
    typeof email !== 'string' ||
    typeof token !== 'string' ||
    typeof locale !== 'string'
  ) {
    throw new Error(`${EMAIL_VERIFICATION_REQUESTED} payload is missing a required field.`);
  }

  return {
    accountId,
    email,
    token,
    locale: toLocale(locale),
  };
}
