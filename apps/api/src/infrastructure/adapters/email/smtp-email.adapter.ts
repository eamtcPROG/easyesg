import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { EmailDispatched, EmailMessage, EmailPort } from '@api/contracts/email.port';
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
    const { subject, body } = renderEmail(message.locale, message.templateKey, message.params);

    const sent = await this.transport.sendMail({
      from: this.settings.from,
      to: message.to,
      subject,
      text: body,
      // The idempotency key travels as the message id's local part so a provider-side duplicate is
      // traceable to the outbox row that caused it (§8.4). It is not a deduplication mechanism —
      // the outbox's `jobId` already is one; this is what makes a redelivery diagnosable.
      headers: { 'X-Idempotency-Key': message.idempotencyKey },
    });

    // NFR-30: the address is never logged here. The idempotency key identifies the send, and the
    // provider's handle is what NFR-107's bounce matching will join on.
    this.logger.log(
      `${message.templateKey} sent via ${this.settings.host} idempotency=${message.idempotencyKey}`,
    );

    return { providerMessageId: typeof sent.messageId === 'string' ? sent.messageId : undefined };
  }
}
