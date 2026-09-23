import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from './notification.port';

/**
 * One set of example values per notification category — what A-17 renders each category's wording with, so an operator
 * reads a message rather than a template (task 67.10; §12.5.6's task-67.10 row (1)).
 *
 * **A `Record` over the category vocabulary**, so a category added without its specimen does not compile — the
 * category's producer brings its example with it, as it brings its wording. **Beside the vocabulary**, in the one
 * surface the producers share, for the reason `NOTIFICATION_CATEGORY` is here. Each specimen names every placeholder
 * its category's wording uses, and `notification-wording.spec.ts` holds it to that in every locale. The values are
 * examples, not data: a name, an entity, a link that goes nowhere.
 */
export const NOTIFICATION_SPECIMEN: Readonly<Record<NotificationCategoryKey, Readonly<Record<string, string>>>> = {
  [NOTIFICATION_CATEGORY.EMAIL_VERIFICATION]: { link: specimenLink('verify?token=…') },
  [NOTIFICATION_CATEGORY.PASSWORD_RESET]: { link: specimenLink('reset?token=…') },
  [NOTIFICATION_CATEGORY.INVITATION]: { link: specimenLink('invitation/…'), organizationName: 'Brutăria Lina SRL' },
  [NOTIFICATION_CATEGORY.ADMIN_INVITATION]: { link: 'https://console.easyesg.md/invitation/…' },
  [NOTIFICATION_CATEGORY.MANUAL_REMINDER]: {
    link: specimenLink('reports/…'),
    senderName: 'Ana Rusu',
    entityName: 'Brutăria Lina SRL',
    fiscalYear: '2026',
    noteGiven: 'given',
    note: 'Mai lipsesc datele despre consumul de energie.',
  },
};

function specimenLink(path: string): string {
  return `https://app.easyesg.md/${path}`;
}
