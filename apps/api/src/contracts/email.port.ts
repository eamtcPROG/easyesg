import type { Locale } from '@easyesg/i18n';

/**
 * Transactional email (§8.2, §12.5.2, AD-11, FR-157, NFR-84).
 *
 * **A minimal port, introduced by task 19 and absorbed rather than duplicated by task 49.** The
 * notification system is FR-157's one channel-agnostic mechanism and no module gets its own mailer
 * — but registration cannot wait for it, and P-7 is what makes waiting unnecessary: a port with one
 * caller today is the same port with the notification service as its caller later, and no call site
 * moves. What must not happen in between is a second way to send mail.
 *
 * §12.5.2 fixes the vocabulary and it is deliberately narrow: **recipient, template key, locale,
 * idempotency key**. No subject, no body, no HTML. Two things follow. The wording is a catalogue
 * key resolved at send time, so no sentence is written in a `.ts` file (OQ-43); and no vendor type
 * crosses this boundary — no Mailjet SDK type, error class or status string appears in `modules/*`,
 * which is NFR-11's stated verification and is enforced by dependency-cruiser rather than by review.
 *
 * The adapter at MVP is **Mailjet (EU)**, chosen in OQ-12 for EU residency and per-message bounce
 * and complaint webhooks, and wired in task 51. Task 19 ships the logging adapter, which is what
 * makes the seam real without pretending a provider relationship exists.
 */
export interface EmailMessage {
  readonly to: string;
  /** FR-169: resolved per recipient from their record, never from a request header. */
  readonly locale: Locale;
  /** Catalogue key. The adapter renders it; the caller never composes text. */
  readonly templateKey: string;
  /** ICU placeholders for the template. Named values, never pre-joined fragments (UX-95). */
  readonly params: Record<string, unknown>;
  /**
   * §8.4: an outbound call carries an idempotency key generated in the originating transaction.
   * Here it is the outbox row's key, so a redelivered job sends one message rather than two.
   */
  readonly idempotencyKey: string;
}

/** A platform result, not a provider response. §12.5.2 says so in terms. */
export interface EmailDispatched {
  /**
   * Whatever the provider calls its message handle, as an opaque string. NFR-107's bounce and
   * complaint feedback is matched against it, which is why it is carried at all — task 51 is where
   * it acquires a consumer.
   */
  readonly providerMessageId?: string;
}

export interface EmailPort {
  send(message: EmailMessage): Promise<EmailDispatched>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const EMAIL_PORT = Symbol('EMAIL_PORT');
