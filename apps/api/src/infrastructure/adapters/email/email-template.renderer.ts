import type { EmailMessage } from '@api/contracts/email.port';
import { renderEmailHtml } from './email-html';
import { readEmailParts } from './email-parts';
import { composeEmailText } from './email-text';

/**
 * Turns a template key plus parameters into a subject, a plain-text part and an HTML part, in the recipient's language.
 *
 * **Rendering is on this side of the port, not the provider's.** `EmailPort` speaks in template
 * keys (§12.5.2) and an adapter could plausibly hand that key to an ESP's own template engine —
 * which would put user-facing wording in a vendor's console, outside the release, outside the
 * FR-64 parity gate and outside every translator's reach. OQ-43 settled where notification wording
 * lives: committed catalogues. This is the function that keeps that true no matter which adapter
 * is registered.
 *
 * Shared rather than per-adapter for the same reason. The logging adapter and the SMTP adapter both
 * call this, so the two cannot render the same notice differently.
 *
 * **Both parts come from one reading of the catalogue** (task 225; §12.5.6's task-225 row (1)): `readEmailParts` resolves
 * every word once, and the plain part and the HTML part lay the same words out, so the two cannot say different things
 * and a client showing text alone loses nothing (UX-66). It throws where a part a message needs is missing — the subject,
 * the heading, the unsubscribe of an email a person may switch off — which puts the job in BullMQ's failed set, where it
 * is visible and re-runnable, rather than sending something that reads like a phishing attempt.
 */
export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export function renderEmail(
  message: Pick<EmailMessage, 'locale' | 'templateKey' | 'params' | 'unsubscribe' | 'operator'>,
): RenderedEmail {
  const parts = readEmailParts(message);
  return { subject: parts.subject, text: composeEmailText(parts), html: renderEmailHtml(parts) };
}

/**
 * The subject and the plain part alone, from the same reading — what A-17's preview shows (§12.5.6's task-225 row (8)).
 * Its read words every category in every locale, so drawing the HTML part for each would be work thrown away on every
 * request; it throws exactly where `renderEmail` would.
 */
export function renderEmailText(
  message: Pick<EmailMessage, 'locale' | 'templateKey' | 'params' | 'unsubscribe' | 'operator'>,
): Pick<RenderedEmail, 'subject' | 'text'> {
  const parts = readEmailParts(message);
  return { subject: parts.subject, text: composeEmailText(parts) };
}
