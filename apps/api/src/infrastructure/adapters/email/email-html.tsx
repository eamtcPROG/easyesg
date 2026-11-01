import { renderToStaticMarkup } from 'react-dom/server';
import type { EmailParts } from './email-parts';
import { EmailMessage } from './templates/email-message';

/**
 * The HTML part, rendered to static markup (task 225; §12.5.6's task-225 row (3)) — the report document's arrangement,
 * React with no script in the result. **React escapes every word it places**, which is the reason it renders the
 * message at all: a reminder's note is text a person typed, and must reach the reader as text.
 */
export function renderEmailHtml(parts: EmailParts): string {
  return `<!doctype html>${renderToStaticMarkup(<EmailMessage parts={parts} />)}`;
}
