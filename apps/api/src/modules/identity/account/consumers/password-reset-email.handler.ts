import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toLocale } from '@easyesg/i18n';
import type { AppConfig } from '@api/config/configuration';
import { EMAIL_PORT, type EmailPort } from '@api/contracts/email.port';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import {
  PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_TEMPLATE,
  type PasswordResetRequested,
} from '../constants/account.constants';

/**
 * Sends the password reset email (FR-6), on the worker, from the outbox — the far end of the
 * chain `RequestPasswordReset` starts, exactly as `VerificationEmailHandler` is for
 * registration; that file's header carries the argument for every choice repeated here (an
 * adapter with no use case behind it, the link built from `PUBLIC_WEB_URL` and never a `Host`
 * header, the locale prefix left for the front end to strip).
 *
 * The link lands on S-02's set-password screen (`apps/web`'s `(identity)/set-password` route),
 * and the token is consumed by an explicit POST, never by opening the URL — the same
 * mail-scanner defence as verification, load-bearing here because this token replaces a
 * credential.
 */
@Injectable()
@HandlesJob(PASSWORD_RESET_REQUESTED)
export class PasswordResetEmailHandler implements JobHandler {
  constructor(
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const event = readEvent(payload);

    const link = new URL(
      `/${event.locale}/set-password`,
      this.config.get('web.publicUrl', { infer: true }),
    );
    link.searchParams.set('token', event.token);

    await this.email.send({
      to: event.email,
      locale: event.locale,
      templateKey: PASSWORD_RESET_TEMPLATE,
      params: { resetUrl: link.toString() },
      idempotencyKey: context.jobId,
    });
  }
}

/** Validates rather than casts — `VerificationEmailHandler.readEvent`'s argument, verbatim. */
function readEvent(payload: Record<string, unknown>): PasswordResetRequested {
  const { accountId, email, locale, token } = payload;

  if (
    typeof accountId !== 'string' ||
    typeof email !== 'string' ||
    typeof token !== 'string' ||
    typeof locale !== 'string'
  ) {
    throw new Error(`${PASSWORD_RESET_REQUESTED} payload is missing a required field.`);
  }

  return {
    accountId,
    email,
    token,
    locale: toLocale(locale),
  };
}
