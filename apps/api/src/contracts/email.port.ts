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
 * **Since task 49.2 that later has arrived** (§12.5.6's task-49.2 row): the notification module is this
 * port's one caller. A producer raises a notice through `NOTIFICATION_PORT`, or — one whose producer
 * holds no request transaction, since task 50.1.4 — has its handler hand the notice to
 * `NOTIFICATION_DELIVERY` (`notification-delivery.port.ts`). This is the provider port, and nothing
 * else; the boundary rule `email-port-behind-notification` refuses any other module that imports it or
 * its adapters.
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
  /**
   * FR-169's one-click unsubscribe, present on every email of a category a person may switch off and on no other
   * (task 52.2.2; §12.5.6's task-52.2 row) — **the one addition to §12.5.2's vocabulary**, and a provider-neutral one:
   * RFC 8058's two headers are the internet's, not a vendor's. The adapter renders `link` as the footer the renderer
   * appends, and sends `oneClickUrl` as `List-Unsubscribe` with `List-Unsubscribe-Post`.
   */
  readonly unsubscribe?: EmailUnsubscribe;
}

/** The two addresses a switchable category's email carries (task 52.2.2). */
export interface EmailUnsubscribe {
  /** S-38, in the recipient's language: the page a person opens from the message. */
  readonly link: string;
  /** RFC 8058's target, which a mail client posts to on the person's behalf. */
  readonly oneClickUrl: string;
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

/**
 * Why a send did not happen, as a platform fact rather than a provider's (task 51.4; §12.5.6's
 * task-51.4 row). §12.5.2's third rule in practice: an SMTP reply code, a nodemailer error class and a
 * future ESP's webhook payload all normalise to one of these two at the adapter, so no module branches
 * on a vendor's spelling of *mailbox not found*.
 *
 * The distinction is the whole of NFR-107: one of them must never be retried and the other must.
 */
export const EMAIL_FAILURE = {
  /** The provider refused the address outright — a 5xx reply, or the recipient rejected at send time. */
  HARD_BOUNCE: 'hard_bounce',
  /** A 4xx, a timeout, a dropped connection: the same message may well succeed on a later attempt. */
  TRANSIENT: 'transient',
} as const;

export type EmailFailure = (typeof EMAIL_FAILURE)[keyof typeof EMAIL_FAILURE];

/**
 * What an adapter throws when a send does not happen.
 *
 * Not a `DomainError`: nothing here becomes an HTTP response. Mail is sent on the worker, where the
 * caller is a queue consumer and the audience is a delivery record and an operator reading a log.
 *
 * `detail` is the provider's own words, kept for support and **never shown to anyone** — it is the one
 * place a vendor string is allowed to survive, because a bounce nobody can diagnose is a support ticket
 * that ends in a shrug. It is written to `notification.suppressed_address.detail` and nowhere else.
 */
export class EmailSendFailed extends Error {
  constructor(
    readonly failure: EmailFailure,
    readonly detail: string,
  ) {
    super(`email send failed: ${failure}`);
    this.name = 'EmailSendFailed';
  }
}

export interface EmailPort {
  send(message: EmailMessage): Promise<EmailDispatched>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const EMAIL_PORT = Symbol('EMAIL_PORT');
