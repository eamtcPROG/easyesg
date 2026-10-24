/**
 * The two closed sets an email's layout is written in (task 225): which card stands above the words, and which state a
 * chip and a badge are drawn in. Declared apart from `EMAIL_LAYOUT`, which reads them, because the templates read them
 * too and a template importing the layout would reach every category it names.
 */

/** The block the heading is followed by, where a message is about one thing (§12.5.6's task-225 row (6)). */
export const EMAIL_CARD = {
  /** The organization an invitation is to — its monogram, its name. */
  ORGANIZATION: 'organization',
  /** One report — its entity, its year, and its standing where the message has one. */
  REPORT: 'report',
  /** One exported file — its format as a badge, and whether it was produced. */
  FILE: 'file',
} as const;

export type EmailCard = (typeof EMAIL_CARD)[keyof typeof EMAIL_CARD];

/** The state a card's chip and badge are drawn in — the cascade's own state hues. */
export const EMAIL_TONE = {
  ATTENTION: 'attention',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type EmailTone = (typeof EMAIL_TONE)[keyof typeof EMAIL_TONE];
