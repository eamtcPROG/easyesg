import { translate } from '@api/app/messages/catalogue';
import type { EmailMessage } from '@api/contracts/email.port';

/**
 * Turns a template key plus parameters into a subject and a body, in the recipient's language.
 *
 * **Rendering is on this side of the port, not the provider's.** `EmailPort` speaks in template
 * keys (§12.5.2) and an adapter could plausibly hand that key to an ESP's own template engine —
 * which would put user-facing wording in a vendor's console, outside the release, outside the
 * FR-64 parity gate and outside every translator's reach. OQ-43 settled where notification wording
 * lives: committed catalogues. This is the function that keeps that true no matter which adapter
 * is registered.
 *
 * Shared rather than per-adapter for the same reason. Task 51 adds Mailjet beside the logging
 * adapter; both call this, so the two cannot render the same notice differently.
 */
export interface RenderedEmail {
  readonly subject: string;
  readonly body: string;
}

/**
 * Throws when the catalogue has no entry.
 *
 * Everywhere else a missing key omits the member rather than printing an identifier — a problem
 * document with no `title` is still a valid problem document. An email with no subject is not a
 * valid email, and sending one is worse than not sending it: the recipient gets something that
 * looks like a phishing attempt from a platform they just signed up to. Failing here puts the job
 * in BullMQ's failed set, where it is visible and re-runnable.
 *
 * **A message carrying an unsubscribe gets its footer here** (task 52.2.2; §12.5.6's task-52.2 row (3)) —
 * `notification.unsubscribe.footer`, one wording for every category a person may switch off, appended to the body
 * rather than placed by each category's author, so no optional category can ship without it. A missing footer
 * throws like a missing subject: an optional email without its unsubscribe is the FR-169 breach, not a lesser email.
 */
export function renderEmail(
  message: Pick<EmailMessage, 'locale' | 'templateKey' | 'params' | 'unsubscribe'>,
): RenderedEmail {
  const { locale, templateKey, params } = message;
  const subject = translate(locale, `notification.${templateKey}.subject`, params);
  const body = translate(locale, `notification.${templateKey}.body`, params);

  if (!subject || !body) {
    throw new Error(
      `Email template "${templateKey}" has no ${!subject ? 'subject' : 'body'} in the ${locale} ` +
        'catalogue. Notification wording ships as a committed catalogue (OQ-43).',
    );
  }
  if (!message.unsubscribe) return { subject, body };

  const footer = translate(locale, UNSUBSCRIBE_FOOTER, { link: message.unsubscribe.link });
  if (!footer) {
    throw new Error(
      `The unsubscribe footer has no wording in the ${locale} catalogue, and an email a person may switch off is not ` +
        'sent without one (FR-169).',
    );
  }
  return { subject, body: `${body}\n\n${footer}` };
}

/** The footer's key, beside the categories' wording in `packages/i18n` (task 52.2.2). */
export const UNSUBSCRIBE_FOOTER = 'notification.unsubscribe.footer';
