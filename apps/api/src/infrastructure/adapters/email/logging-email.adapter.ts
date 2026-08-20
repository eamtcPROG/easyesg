import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { EmailDispatched, EmailMessage, EmailPort } from '@api/contracts/email.port';
import { renderEmail } from './email-template.renderer';

/**
 * The development `EmailPort` adapter: renders the message and writes it to the application log.
 *
 * **It exists so the port has a real caller before a provider relationship does**, which is what
 * task 19 owes P-7 — and so a developer running the stack can follow the verification link that
 * task 20's screens produce. Mailjet (OQ-12) arrives in task 51 beside it, rendering through the
 * same function.
 *
 * **It writes a recipient address and a verification link into the log, and NFR-30 forbids exactly
 * that of a production logging pipeline.** That is why `EMAIL_PROVIDER` has no default and this
 * adapter is registered only when an environment names it: a deployment that has not chosen a
 * provider fails at boot rather than quietly logging personal data for months. The address is
 * additionally pseudonymised at `log` level, so the ordinary operational line carries no personal
 * data at all and only `debug` — off by default — carries the message itself.
 */
/** The EMAIL_PROVIDER value that selects this adapter. Same rule as APP_MODE: compared, so named. */
export const LOG_EMAIL_PROVIDER = 'log';

export class LoggingEmailAdapter implements EmailPort {
  private readonly logger = new Logger(`EmailPort:${LOG_EMAIL_PROVIDER}`);

  /** NFR-30's "pseudonymous identifiers only". Stable per address, so a thread can be followed. */
  private pseudonym(address: string): string {
    return createHash('sha256').update(address.toLowerCase(), 'utf8').digest('hex').slice(0, 12);
  }

  send(message: EmailMessage): Promise<EmailDispatched> {
    // Rendered before anything is claimed to have been sent, so a missing or malformed template
    // fails here — in development, on the first send — rather than at task 51 against a provider.
    const { subject, body } = renderEmail(message.locale, message.templateKey, message.params);

    this.logger.log(
      `${message.templateKey} → ${this.pseudonym(message.to)} [${message.locale}] ` +
        `idempotency=${message.idempotencyKey}`,
    );
    this.logger.debug(`To: ${message.to}\nSubject: ${subject}\n\n${body}`);

    // No provider handle: nothing was dispatched to a provider. Returning a fabricated id would
    // make task 51's bounce matching (NFR-107) look wired when it is not.
    return Promise.resolve({});
  }
}
