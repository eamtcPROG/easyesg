import type { Locale } from '@easyesg/i18n';

/**
 * The verification email as it travels: an outbox `event_type`, which the dispatcher turns into a
 * BullMQ job name, which the consumer selects on (AD-10's single queue, §6.7).
 *
 * Namespaced `<context>.<subject>.<past-tense-fact>` because the queue is shared by every kind of
 * work in the system and a bare `send_email` would collide with the first other producer.
 */
export const EMAIL_VERIFICATION_REQUESTED = 'identity.email_verification.requested';

/**
 * Catalogue key for the message itself. Template wording is a committed catalogue, not
 * configuration (OQ-43): a genuinely new notice cannot exist until code calls for it, so the
 * wording may as well ship with the release that introduces the call.
 */
export const EMAIL_VERIFICATION_TEMPLATE = 'identity.email_verification';

/**
 * **This payload carries the raw token** (OQ-54, closed 20 Aug 2026). `identity.verification_token`
 * holds only its SHA-256, so this is the one durable place the usable value exists, and the
 * exposure is bounded by grant: `esg_app` may INSERT into `audit.outbox_event` and not SELECT from
 * it, so the tier that mints a token cannot read one back; `esg_worker` and `esg_admin_ro` can, and
 * every `esg_admin_ro` acquisition is logged (§7.6, NFR-66).
 *
 * The alternative — the consumer mints the token — was rejected because an invitation (FR-11) is a
 * revocable record that must exist when the request commits, so it cannot be minted by a consumer,
 * and one token pattern across all three kinds is worth more than the narrower exposure.
 */
export interface EmailVerificationRequested {
  readonly accountId: string;
  readonly email: string;
  /** FR-169: per recipient, from their record. A worker has no `Accept-Language` to negotiate. */
  readonly locale: Locale;
  readonly token: string;
}

/** FR-6's reset email as it travels — same pattern as the verification event above (task 21). */
export const PASSWORD_RESET_REQUESTED = 'identity.password_reset.requested';

export const PASSWORD_RESET_TEMPLATE = 'identity.password_reset';

/**
 * Carries the raw token under OQ-54's decision and its bounds: the table holds the SHA-256,
 * `esg_app` cannot read the outbox back, and the payload is the one durable place the usable
 * value exists on its way to the account holder.
 */
export interface PasswordResetRequested {
  readonly accountId: string;
  readonly email: string;
  readonly locale: Locale;
  readonly token: string;
}
