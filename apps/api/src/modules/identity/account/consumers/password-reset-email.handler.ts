import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import {
  NOTICE_APPLICATION,
  NOTIFICATION_DELIVERY,
  type NotificationDeliveryPort,
} from '@api/contracts/notification-delivery.port';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import {
  PASSWORD_LINK_INTENT,
  PASSWORD_LINK_INTENT_PARAM,
  PASSWORD_RESET_REQUESTED,
  PASSWORD_SETUP_TEMPLATE,
  type PasswordResetRequested,
} from '../constants/account.constants';

/**
 * Sends the password reset email (FR-6), on the worker, from the outbox — the far end of the
 * chain `RequestPasswordReset` starts, exactly as `VerificationEmailHandler` is for
 * registration; that file's header carries the argument for every choice repeated here (an
 * adapter with no use case behind it, the path named here and made absolute against
 * `PUBLIC_WEB_URL` by the notification module, the locale prefix left for the front end to strip,
 * the notice recorded with its link sealed since task 50.1.4).
 *
 * The link lands on S-02's set-password screen (`apps/web`'s `(identity)/set-password` route),
 * and the token is consumed by an explicit POST, never by opening the URL — the same
 * mail-scanner defence as verification, load-bearing here because this token replaces a
 * credential.
 *
 * **Two wordings, one link** (task 155). An account holding no password is sent the *set a password*
 * message; the link, its lifetime and what consuming it does are identical, so the choice is the
 * template and the page's own words, and nothing else.
 */
@Injectable()
@HandlesJob(PASSWORD_RESET_REQUESTED)
export class PasswordResetEmailHandler implements JobHandler {
  constructor(@Inject(NOTIFICATION_DELIVERY) private readonly delivery: NotificationDeliveryPort) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const event = readEvent(payload);
    // Only the page's words: S-02 reads it to say *set a password*, and the token decides the rest.
    const intent: Record<string, string> = event.holdsPassword
      ? {}
      : { [PASSWORD_LINK_INTENT_PARAM]: PASSWORD_LINK_INTENT.SETUP };
    const path = (query: Record<string, string>) => {
      const search = new URLSearchParams(query).toString();
      return search === '' ? '/set-password' : `/set-password?${search}`;
    };

    await this.delivery.deliver({
      issuanceKey: context.jobId,
      occurredAtMicros: occurredAtMicrosOf(payload, PASSWORD_RESET_REQUESTED),
      categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
      // The category's second wording (task 155); the reset's own is the category's key.
      ...(event.holdsPassword ? {} : { templateKey: PASSWORD_SETUP_TEMPLATE }),
      recipient: { accountId: event.accountId },
      application: NOTICE_APPLICATION.WEB,
      deepLink: path(intent),
      linkPath: path({ token: event.token, ...intent }),
      params: {},
    });
  }
}

/** Validates rather than casts — `VerificationEmailHandler.readEvent`'s argument, verbatim. */
function readEvent(
  payload: Record<string, unknown>,
): Pick<PasswordResetRequested, 'accountId' | 'token' | 'holdsPassword'> {
  const { accountId, token, holdsPassword } = payload;

  if (typeof accountId !== 'string' || typeof token !== 'string') {
    throw new Error(`${PASSWORD_RESET_REQUESTED} payload is missing a required field.`);
  }

  return {
    accountId,
    token,
    // A row written before task 155 carries no flag, and every such row was a reset of a held
    // password — `RequestPasswordReset` issued to active accounts only — so absent reads as held.
    holdsPassword: typeof holdsPassword === 'boolean' ? holdsPassword : true,
  };
}
