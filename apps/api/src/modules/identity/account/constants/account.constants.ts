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

/**
 * The same link, worded for an account holding no password (task 155, §12.5.6's task-155 row (8)) —
 * *set a password* rather than *reset*, and without telling the reader their current password stays
 * unchanged, which for this account is false. **One trigger, so one notification category** —
 * `identity.password_reset` — and this is that category's second wording (tasks 49.1, 49.2).
 */
export const PASSWORD_SETUP_TEMPLATE = 'identity.password_setup';

/**
 * The set-password link's wording flag (task 155; §12.5.6's task-155 row (8)) — the query parameter
 * S-02 reads to word its step as setting a first password. **Presentational only**: the token alone
 * decides what consuming the link does, so a link edited to carry or drop it changes S-02's sentences
 * and nothing else. `apps/web`'s `set-password-kind.ts` reads the same literal, and each side's spec
 * pins it.
 */
export const PASSWORD_LINK_INTENT_PARAM = 'intent';

export const PASSWORD_LINK_INTENT = { SETUP: 'setup' } as const;

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
  /**
   * Whether the account held a password when the link was requested (task 155) — the worker's one
   * input to which wording it sends. Decided here, on the request's transaction, because the worker
   * reads no credential and should not start.
   */
  readonly holdsPassword: boolean;
}
