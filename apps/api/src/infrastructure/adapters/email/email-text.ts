import type { EmailParts } from './email-parts';

/**
 * The plain-text part, composed from the same parts the HTML part is (task 225; §12.5.6's task-225 row (1)) — what a
 * client that shows text alone reads, and what A-17's preview shows. **Everything the message says is here**, in the
 * HTML part's reading order, so the plain part is never the lesser message (UX-66). Three things are left out because
 * each restates or explains what is already here: the card (the heading and the intro name its subject), the category's
 * name above the heading, and the line that explains the written-out link — the link here is the only form there is.
 *
 * The signature delimiter is RFC 3676's `-- ` — a dash, a dash and a space — which a mail client may dim as a footer.
 */
export function composeEmailText(parts: EmailParts): string {
  const blocks: string[] = [
    parts.heading,
    parts.greeting,
    ...parts.intro,
    ...(parts.list.length === 0 ? [] : [parts.list.join('\n')]),
    ...(parts.outro === undefined ? [] : [parts.outro]),
    `${parts.action}:\n${parts.link}`,
    ...(parts.facts.length === 0 ? [] : [parts.facts.join(' · ')]),
    ...(parts.note === undefined ? [] : [[parts.note.lead, parts.note.body].filter(Boolean).join(' ')]),
    parts.reason,
    ...(parts.unsubscribe === undefined ? [] : [parts.unsubscribe.footer]),
    [SIGNATURE_DELIMITER, parts.product, ...(parts.operator === undefined ? [] : [parts.operator])].join('\n'),
  ];
  return blocks.join('\n\n');
}

const SIGNATURE_DELIMITER = '-- ';
