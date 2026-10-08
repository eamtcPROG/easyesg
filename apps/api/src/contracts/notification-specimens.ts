import type { NoticeParam } from './notice-params';
import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from './notification.port';

/** The organization and entity every specimen names, so the console's examples read as one business. */
const SPECIMEN_ENTITY = 'Brutăria Lina SRL';

/**
 * One set of example values per notification category — what A-17 renders each category's wording with, so an operator
 * reads a message rather than a template (task 67.10; §12.5.6's task-67.10 row (1)).
 *
 * **A `Record` over the category vocabulary**, so a category added without its specimen does not compile — the
 * category's producer brings its example with it, as it brings its wording. **Beside the vocabulary**, in the one
 * surface the producers share, for the reason `NOTIFICATION_CATEGORY` is here. Each specimen names every placeholder
 * its category's wording uses, and `notification-wording.spec.ts` holds it to that in every locale. The values are
 * examples, not data: a name, an entity, a link that goes nowhere — and, since task 51.2, a field list and a date, which
 * the console renders in each locale as a recipient would read them (`NoticeParam`).
 */
export const NOTIFICATION_SPECIMEN: Readonly<Record<NotificationCategoryKey, Readonly<Record<string, NoticeParam>>>> = {
  [NOTIFICATION_CATEGORY.EMAIL_VERIFICATION]: { link: specimenLink('verify?token=…') },
  [NOTIFICATION_CATEGORY.PASSWORD_RESET]: { link: specimenLink('reset?token=…') },
  [NOTIFICATION_CATEGORY.INVITATION]: { link: specimenLink('invitation/…'), organizationName: SPECIMEN_ENTITY },
  [NOTIFICATION_CATEGORY.ADMIN_INVITATION]: { link: 'https://console.easyesg.md/invitation/…' },
  [NOTIFICATION_CATEGORY.MANUAL_REMINDER]: {
    link: specimenLink('reports/…'),
    senderName: 'Ana Rusu',
    entityName: SPECIMEN_ENTITY,
    fiscalYear: '2026',
    noteGiven: 'given',
    note: 'Mai lipsesc datele despre consumul de energie.',
  },
  // One report reached, the wording's fuller arm: it names the entity and the year as well as the two sets.
  [NOTIFICATION_CATEGORY.REPORT_UPDATE]: {
    link: specimenLink('reports/…/calculator'),
    reach: 'one',
    setLabel: '2026.1',
    newSetLabel: '2026.2',
    entityName: SPECIMEN_ENTITY,
    fiscalYear: '2026',
  },
  // Three fields in two modules: enough to show the list's shape, the module and its fields' labels.
  [NOTIFICATION_CATEGORY.OUTSTANDING_REPORT]: {
    link: specimenLink('reports/…'),
    entityName: SPECIMEN_ENTITY,
    fiscalYear: '2026',
    count: 3,
    intervalDays: 7,
    fields: {
      fieldList: {
        taxonomyVersion: '2026-05-01',
        modules: [
          { module: 'B1', elementKeys: ['Turnover', 'NumberOfEmployees'] },
          { module: 'B3', elementKeys: ['TotalEnergyConsumption'] },
        ],
      },
    },
  },
  // A week before the due date, the report begun: the wording's fuller arm, which counts what is left.
  [NOTIFICATION_CATEGORY.REPORT_DEADLINE]: {
    link: specimenLink('reports/…'),
    entityName: SPECIMEN_ENTITY,
    fiscalYear: '2026',
    dueDate: { calendarDate: '2027-05-30' },
    daysRemaining: 7,
    started: 'yes',
    outstanding: 4,
  },
};

function specimenLink(path: string): string {
  return `https://app.easyesg.md/${path}`;
}
