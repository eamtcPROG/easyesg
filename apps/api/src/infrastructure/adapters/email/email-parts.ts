import { SOURCE_LOCALE, leafKeys, type Locale } from '@easyesg/i18n';
import { translate } from '@api/app/messages/catalogue';
import { COMMITTED_CATALOGUES } from '@api/app/messages/committed-catalogues';
import type { EmailMessage } from '@api/contracts/email.port';
import { layoutOf } from './email-layout';
import type { EmailCard, EmailTone } from './email-vocabulary';

/**
 * Every word one email says, resolved from the catalogue in the recipient's language (task 225; §12.5.6's task-225 row
 * (2)) — **the one set of parts both the HTML part and the plain-text part are composed from**, so the two cannot say
 * different things. Reading them is this file's one behaviour; laying them out is `email-html.tsx`'s and
 * `email-text.ts`'s.
 *
 * **A missing required part throws**, as the subject did before: an email with no heading or no button is not a lesser
 * email, and a throw puts the job in the queue's failed set where it is visible. An optional part whose words resolve
 * to nothing — the reminder's note when none was given — is simply absent.
 */
export interface EmailParts {
  readonly locale: Locale;
  readonly subject: string;
  /** The inbox's preview line, hidden in the message itself. */
  readonly preheader: string;
  /** The category's name, above the heading, where the template is a category's. */
  readonly eyebrow?: string;
  readonly heading: string;
  readonly greeting: string;
  /** The intro's paragraphs. */
  readonly intro: readonly string[];
  readonly card?: EmailCardParts;
  /** One row per line — a field list's modules. */
  readonly list: readonly string[];
  readonly outro?: string;
  readonly action: string;
  readonly link: string;
  /** What to do when the button does nothing — the link written out beneath it. */
  readonly fallback: string;
  /** Short facts about the link — how long it lasts, how often it works. */
  readonly facts: readonly string[];
  readonly note?: { readonly lead?: string; readonly body: string };
  readonly reason: string;
  readonly unsubscribe?: { readonly label: string; readonly footer: string; readonly link: string };
  readonly product: string;
  /** The operator as A-21 publishes it, worded — absent where it could not be read (row (7)). */
  readonly operator?: string;
}

export interface EmailCardParts {
  readonly kind: EmailCard;
  readonly tone?: EmailTone;
  readonly title: string;
  readonly caption?: string;
  readonly status?: string;
  readonly badge?: string;
}

/** The parts every template must word; the gate (`notification-wording.spec.ts`) and A-17's refusal ask the same. */
export const EMAIL_REQUIRED_PARTS = ['subject', 'preheader', 'heading', 'intro', 'action', 'reason'] as const;

/** The words every email shares, under `notification.email.*`. */
const SHARED = 'notification.email';
/** FR-169's footer, which the plain-text part carries against the unsubscribe link (task 52.2.2). */
export const UNSUBSCRIBE_FOOTER = 'notification.unsubscribe.footer';

export function readEmailParts(
  message: Pick<EmailMessage, 'locale' | 'templateKey' | 'params' | 'unsubscribe' | 'operator'>,
): EmailParts {
  const { locale, templateKey, params } = message;
  const root = `notification.${templateKey}`;
  const optional = (key: string, values: Record<string, unknown> = params): string | undefined => {
    const words = translate(locale, key, values);
    return words === undefined || words.trim() === '' ? undefined : words;
  };
  const required = (key: string, what: string, values?: Record<string, unknown>): string => {
    const words = optional(key, values);
    if (words === undefined) {
      throw new Error(
        `Email template "${templateKey}" has no ${what} in the ${locale} catalogue. ` +
          'Notification wording ships as a committed catalogue (OQ-43).',
      );
    }
    return words;
  };
  const part = (name: (typeof EMAIL_REQUIRED_PARTS)[number]) => required(`${root}.email.${name}`, name);

  const link = params.link;
  if (typeof link !== 'string' || link === '') throw new Error(`Email template "${templateKey}" was given no link to open.`);

  const layout = layoutOf(templateKey);
  const title = layout.card === undefined ? undefined : optional(`${root}.email.card.title`);
  const listed = layout.list === undefined ? undefined : params[layout.list];
  const noteBody = optional(`${root}.email.note.body`);
  const noteLead = optional(`${root}.email.note.lead`);

  return {
    locale,
    subject: part('subject'),
    preheader: part('preheader'),
    ...present('eyebrow', optional(`${root}.name`)),
    heading: part('heading'),
    greeting: required(`${SHARED}.greeting`, 'greeting'),
    intro: part('intro').split('\n\n'),
    ...(layout.card === undefined || title === undefined
      ? {}
      : {
          card: {
            kind: layout.card,
            title,
            ...present('tone', layout.tone?.(params)),
            ...present('caption', optional(`${root}.email.card.caption`)),
            ...present('status', optional(`${root}.email.card.status`)),
            ...present('badge', optional(`${root}.email.card.badge`)),
          },
        }),
    list: Array.isArray(listed) ? listed.map(String) : typeof listed === 'string' && listed !== '' ? [listed] : [],
    ...present('outro', optional(`${root}.email.outro`)),
    action: part('action'),
    link,
    fallback: required(`${SHARED}.fallback`, 'link fallback'),
    facts: factKeys(templateKey).flatMap((key) => optional(key) ?? []),
    ...(noteBody === undefined ? {} : { note: { ...present('lead', noteLead), body: noteBody } }),
    reason: part('reason'),
    ...(message.unsubscribe === undefined
      ? {}
      : {
          unsubscribe: {
            label: required(`${SHARED}.unsubscribe`, 'unsubscribe label'),
            // An email a person may switch off is not sent without its unsubscribe (FR-169).
            footer: required(UNSUBSCRIBE_FOOTER, 'unsubscribe footer', { link: message.unsubscribe.link }),
            link: message.unsubscribe.link,
          },
        }),
    product: required(`${SHARED}.product`, 'product line'),
    ...present(
      'operator',
      message.operator === undefined
        ? undefined
        : optional(`${SHARED}.operator`, { name: message.operator.name, address: message.operator.address }),
    ),
  };
}

/** `{ [name]: value }` where the value is there, nothing where it is not — an optional member left out, not `undefined`. */
const present = <K extends string, V>(name: K, value: V | undefined): { [P in K]?: V } =>
  (value === undefined ? {} : { [name]: value }) as { [P in K]?: V };

/**
 * A template's facts, in the order the source catalogue writes them. Read from the source locale's keys, because the
 * facts are named rather than numbered and the parity harness holds every locale to the same names.
 */
function factKeys(templateKey: string): string[] {
  const prefix = `notification.${templateKey}.email.facts.`;
  sourceKeys ??= leafKeys(COMMITTED_CATALOGUES[SOURCE_LOCALE]);
  return sourceKeys.filter((key) => key.startsWith(prefix));
}

/** The source catalogue's keys, read once: the catalogue is committed and does not change while the process runs. */
let sourceKeys: string[] | undefined;
