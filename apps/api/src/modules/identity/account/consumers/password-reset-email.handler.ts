import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toLocale } from '@easyesg/i18n';
import type { AppConfig } from '@api/config/configuration';
import { EMAIL_PORT, type EmailPort } from '@api/contracts/email.port';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import {
  PASSWORD_LINK_INTENT,
  PASSWORD_LINK_INTENT_PARAM,
  PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_TEMPLATE,
  PASSWORD_SETUP_TEMPLATE,
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
 *
 * **Two wordings, one link** (task 155). An account holding no password is sent the *set a password*
 * message; the link, its lifetime and what consuming it does are identical, so the choice is the
 * template and nothing else.
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
    // Only the page's words: S-02 reads it to say *set a password*, and the token decides the rest.
    if (!event.holdsPassword) link.searchParams.set(PASSWORD_LINK_INTENT_PARAM, PASSWORD_LINK_INTENT.SETUP);

    await this.email.send({
      to: event.email,
      locale: event.locale,
      templateKey: event.holdsPassword ? PASSWORD_RESET_TEMPLATE : PASSWORD_SETUP_TEMPLATE,
      params: { resetUrl: link.toString() },
      idempotencyKey: context.jobId,
    });
  }
}

/** Validates rather than casts — `VerificationEmailHandler.readEvent`'s argument, verbatim. */
function readEvent(payload: Record<string, unknown>): PasswordResetRequested {
  const { accountId, email, locale, token, holdsPassword } = payload;

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
    // A row written before task 155 carries no flag, and every such row was a reset of a held
    // password — `RequestPasswordReset` issued to active accounts only — so absent reads as held.
    holdsPassword: typeof holdsPassword === 'boolean' ? holdsPassword : true,
  };
}
