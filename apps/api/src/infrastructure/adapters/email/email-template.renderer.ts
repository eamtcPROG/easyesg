import type { Locale } from '@easyesg/i18n';
import { translate } from '@api/app/messages/catalogue';

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
 */
export function renderEmail(
  locale: Locale,
  templateKey: string,
  params: Record<string, unknown>,
): RenderedEmail {
  const subject = translate(locale, `notification.${templateKey}.subject`, params);
  const body = translate(locale, `notification.${templateKey}.body`, params);

  if (!subject || !body) {
    throw new Error(
      `Email template "${templateKey}" has no ${!subject ? 'subject' : 'body'} in the ${locale} ` +
        'catalogue. Notification wording ships as a committed catalogue (OQ-43).',
    );
  }

  return { subject, body };
}
