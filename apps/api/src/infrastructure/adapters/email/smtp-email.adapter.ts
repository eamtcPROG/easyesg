import { Logger } from '@nestjs/common';
import { createTransport, type SentMessageInfo, type Transporter } from 'nodemailer';
import {
  EMAIL_FAILURE,
  EmailSendFailed,
  type EmailDispatched,
  type EmailMessage,
  type EmailPort,
} from '@api/contracts/email.port';
import { renderEmail } from './email-template.renderer';

/**
 * The production `EmailPort` adapter: one transport speaking **SMTP**, with the provider chosen
 * entirely from the environment.
 *
 * **It is not "the Gmail adapter" or "the Mailjet adapter", and that is the design rather than a
 * naming preference.** §12.5.2 requires a provider swap to be *"a configuration change, not a code
 * change"*, and SMTP is the one interface every candidate exposes — so this class serves Mailjet,
 * Gmail or any permitted EU host identically, and **no vendor type crosses the port because none
 * enters it**. A provider SDK would have put one inside the adapter and made the swap a class.
 *
 * **Rendering stays on this side of the port.** `renderEmail` is the same function the logging
 * adapter calls, so the two cannot drift in what a message says — only in where it goes. OQ-43
 * keeps the wording in committed catalogues rather than in the provider's templates, which is what
 * makes that possible at all.
 *
 * **Timeouts are configured rather than defaulted, and the reason is the caller.** The outbox
 * dispatcher awaits each send while holding the row's lock (AD-10, P-8), so a transport that hangs
 * holds a database row open for as long as it hangs. nodemailer's defaults are generous; these are
 * not.
 *
 * **A failed send throws.** The consumer is a BullMQ job, so a throw is a retry with the queue's
 * backoff, and the outbox row stays unacknowledged — which is the at-least-once delivery AD-10
 * already provides. Swallowing the error here would turn an undelivered verification mail into a
 * silently successful one, and the account it belongs to would wait forever for a link nobody sent.
 */
export const SMTP_EMAIL_PROVIDER = 'smtp';

/** What the environment must supply for {@link SmtpEmailAdapter}. Resolved and checked in config. */
export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  /** The address recipients see. Providers reject a `From` they do not consider authorised. */
  readonly from: string;
}

/**
 * Milliseconds. Chosen against the outbox's lock rather than against a provider's SLA: three
 * failed sends at these values cost under a minute of held row, and the job retries.
 */
const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };

export class SmtpEmailAdapter implements EmailPort {
  private readonly logger = new Logger(`EmailPort:${SMTP_EMAIL_PROVIDER}`);
  private readonly transport: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transport = createTransport({
      host: settings.host,
      port: settings.port,
      // `secure` is the implicit-TLS form on 465; 587 upgrades with STARTTLS, which nodemailer
      // does on its own. Deriving it from the port rather than taking a third environment value
      // removes a combination that is wrong in one direction and silently insecure in the other.
      secure: settings.port === 465,
      auth: { user: settings.user, pass: settings.password },
      ...TIMEOUTS,
    });
  }

  async send(message: EmailMessage): Promise<EmailDispatched> {
    // Rendered before the transport is touched, so a missing catalogue key fails as a template
    // error rather than as a provider error — the logging adapter's order, for the same reason.
    const { subject, body } = renderEmail(message);

    const sent = await this.sendOrClassify({
      from: this.settings.from,
      to: message.to,
      subject,
      text: body,
      // The idempotency key travels as the message id's local part so a provider-side duplicate is
      // traceable to the outbox row that caused it (§8.4). It is not a deduplication mechanism —
      // the outbox's `jobId` already is one; this is what makes a redelivery diagnosable.
      headers: { 'X-Idempotency-Key': message.idempotencyKey, ...oneClickHeaders(message) },
    });

    // NFR-30: the address is never logged here. The idempotency key identifies the send, and the
    // provider's handle is what NFR-107's bounce matching will join on.
    this.logger.log(
      `${message.templateKey} sent via ${this.settings.host} idempotency=${message.idempotencyKey}`,
    );

    return { providerMessageId: typeof sent.messageId === 'string' ? sent.messageId : undefined };
  }

  /**
   * The send, with every way it can fail turned into one of `EMAIL_FAILURE`'s two (task 51.4).
   *
   * **This is the seam §12.5.2's third rule describes**, and the reason 51.1's transport being
   * provider-neutral did not make the whole channel so: a reply code is SMTP's vocabulary, a webhook
   * payload would be an ESP's, and above this line neither exists. When an ESP is configured, its
   * adapter writes this function again and nothing else changes.
   *
   * **A hard bounce needs evidence about the ADDRESS, and a 5xx alone is not that.** The first draft
   * read any 5xx reply as a refusal of the recipient, which an existing spec caught in one line:
   * `535` is *authentication failed*, a fact about this platform's own credentials — so a mistyped
   * SMTP password would have suppressed every address it was used to write to, permanently, with no
   * `DELETE` grant to undo it. The consequences of the two mistakes are not symmetric: classifying a
   * real bounce as transient costs eleven retries and a job in the failed set, while classifying a
   * configuration error as a bounce quietly destroys a mailing list.
   *
   * So a refusal is permanent only when the provider **names the recipient it rejected**:
   *
   * - **A resolved send with `rejected` recipients.** `sendMail` resolves when *some* recipient was
   *   accepted, so reading only the thrown case would record that refusal as an acceptance.
   * - **A thrown error carrying `rejected`**, which nodemailer sets when every recipient was refused,
   *   with `rejectedErrors` holding each one's reply. Permanent only if those replies are 5xx — a
   *   4xx rejection is *not now*, which is exactly what the retry is for.
   *
   * Everything else — an auth failure, a timeout, a dropped socket, DNS — is transient, and lands in
   * BullMQ's failed set after NFR-107's schedule where an operator can see it.
   */
  private async sendOrClassify(mail: Parameters<Transporter['sendMail']>[0]): Promise<SentMessageInfo> {
    const sent: SentMessageInfo = await this.transport.sendMail(mail).catch((cause: unknown) => {
      throw new EmailSendFailed(
        recipientRefused(cause) ? EMAIL_FAILURE.HARD_BOUNCE : EMAIL_FAILURE.TRANSIENT,
        cause instanceof Error ? cause.message : String(cause),
      );
    });

    if (Array.isArray(sent.rejected) && sent.rejected.length > 0) {
      throw new EmailSendFailed(
        EMAIL_FAILURE.HARD_BOUNCE,
        typeof sent.response === 'string' ? sent.response : 'recipient rejected',
      );
    }
    return sent;
  }
}

/** A 5xx reply is permanent; `undefined` is not a reply at all, so it is not. */
const permanentReply = (code: unknown): boolean => typeof code === 'number' && code >= 500 && code < 600;

/**
 * Whether the provider refused **this recipient**, as opposed to refusing us or failing to answer.
 *
 * Read off `rejected` rather than the reply code, for the reason `sendOrClassify` states at length:
 * only a per-recipient refusal is evidence about the address, and only that may suppress it.
 */
const recipientRefused = (cause: unknown): boolean => {
  const { rejected, rejectedErrors, responseCode } = cause as {
    rejected?: unknown;
    rejectedErrors?: unknown;
    responseCode?: unknown;
  };
  if (!Array.isArray(rejected) || rejected.length === 0) return false;
  return Array.isArray(rejectedErrors) && rejectedErrors.length > 0
    ? rejectedErrors.every((error) => permanentReply((error as { responseCode?: unknown }).responseCode))
    : permanentReply(responseCode);
};

/**
 * RFC 8058's one-click unsubscribe (task 52.2.2; FR-169), on a message that carries one and on no other. **Both
 * headers or neither**: `List-Unsubscribe` alone invites a mail client to open the URL with a `GET`, which S-38's
 * route handler does not answer; `List-Unsubscribe-Post` is what tells it to `POST`, with no page and no second click.
 */
const oneClickHeaders = (message: EmailMessage): Record<string, string> =>
  message.unsubscribe
    ? {
        'List-Unsubscribe': `<${message.unsubscribe.oneClickUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    : {};
