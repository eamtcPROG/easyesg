import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '@api/contracts/notification.port';
import { EXPORT_STATUS } from '@api/modules/core/export/constants/export.constants';
import { EMAIL_CARD, EMAIL_TONE, type EmailCard, type EmailTone } from './email-vocabulary';

/**
 * Which blocks each category's email carries beyond the anatomy every email shares (task 225; §12.5.6's task-225 row
 * (6)). **A `Record` over the category vocabulary**, so a category added to `NOTIFICATION_CATEGORY` without a layout
 * does not compile — the arrangement `NOTIFICATION_SPECIMEN` uses for the same reason. The words of a card are the
 * catalogue's (`…email.card.*`); what this file holds is shape, which is code's.
 */
export interface EmailLayout {
  /** The card that follows the heading, if the message is about one thing. */
  readonly card?: EmailCard;
  /** The state the card's chip and badge are drawn in, read from the message's own params. */
  readonly tone?: (params: Readonly<Record<string, unknown>>) => EmailTone;
  /** A param holding lines, drawn one per row after the intro — a field list, one module a line. */
  readonly list?: string;
}

const PLAIN: EmailLayout = {};
const REPORT: EmailLayout = { card: EMAIL_CARD.REPORT };
const REPORT_NEEDING_ATTENTION: EmailLayout = { card: EMAIL_CARD.REPORT, tone: () => EMAIL_TONE.ATTENTION };

export const EMAIL_LAYOUT: Readonly<Record<NotificationCategoryKey, EmailLayout>> = {
  [NOTIFICATION_CATEGORY.EMAIL_VERIFICATION]: PLAIN,
  [NOTIFICATION_CATEGORY.PASSWORD_RESET]: PLAIN,
  [NOTIFICATION_CATEGORY.INVITATION]: { card: EMAIL_CARD.ORGANIZATION },
  [NOTIFICATION_CATEGORY.ADMIN_INVITATION]: PLAIN,
  [NOTIFICATION_CATEGORY.MANUAL_REMINDER]: REPORT,
  [NOTIFICATION_CATEGORY.REPORT_UPDATE]: REPORT,
  [NOTIFICATION_CATEGORY.OUTSTANDING_REPORT]: { ...REPORT_NEEDING_ATTENTION, list: 'fields' },
  [NOTIFICATION_CATEGORY.REPORT_DEADLINE]: REPORT_NEEDING_ATTENTION,
  [NOTIFICATION_CATEGORY.EXPORT_FINISHED]: {
    card: EMAIL_CARD.FILE,
    tone: (params) => (params.outcome === EXPORT_STATUS.FAILED ? EMAIL_TONE.ERROR : EMAIL_TONE.SUCCESS),
  },
};

const isCategoryKey = (key: string): key is NotificationCategoryKey => Object.hasOwn(EMAIL_LAYOUT, key);

/**
 * A template's layout. **A template no category names — the reset's first-password wording — takes the plain
 * anatomy**, which is what a link notice needs; its words still carry every part the plain anatomy asks.
 */
export const layoutOf = (templateKey: string): EmailLayout => (isCategoryKey(templateKey) ? EMAIL_LAYOUT[templateKey] : PLAIN);
