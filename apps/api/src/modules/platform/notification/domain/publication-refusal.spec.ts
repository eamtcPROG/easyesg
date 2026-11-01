import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NOTIFICATION_CHANNEL, NOTIFICATION_CLASSIFICATION } from '../models/notification-category.model';
import { publicationRefusal } from './publication-refusal';

/** A-17's rules (task 67.10): what no operator may publish, each on its own. Literals on purpose: the wire values. */
describe('publicationRefusal (task 67.10)', () => {
  const all = () => true;
  const { EMAIL, IN_APP } = NOTIFICATION_CHANNEL;
  const { OPTIONAL, TRANSACTIONAL } = NOTIFICATION_CLASSIFICATION;

  it('admits an optional category on both channels', () => {
    expect(
      publicationRefusal({
        categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
        behaviour: { channels: [IN_APP, EMAIL], classification: OPTIONAL },
        worded: all,
      }),
    ).toBeNull();
  });

  it('admits a mandatory address notice by email, transactional', () => {
    expect(
      publicationRefusal({
        categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
        behaviour: { channels: [EMAIL], classification: TRANSACTIONAL },
        worded: all,
      }),
    ).toBeNull();
  });

  it.each([
    ['a mandatory category classified optional', NOTIFICATION_CATEGORY.PASSWORD_RESET, [EMAIL], OPTIONAL, 'mandatory_classification'],
    ['a mandatory category without email', NOTIFICATION_CATEGORY.EMAIL_VERIFICATION, [IN_APP], TRANSACTIONAL, 'mandatory_without_email'],
    ['in-app for an address notice', NOTIFICATION_CATEGORY.INVITATION, [EMAIL, IN_APP], TRANSACTIONAL, 'address_notice_in_app'],
  ] as const)('refuses %s', (_case, categoryKey, channels, classification, refusal) => {
    expect(publicationRefusal({ categoryKey, behaviour: { channels, classification }, worded: all })).toBe(refusal);
  });

  it('admits each cadence on the category that keeps it (task 51.2)', () => {
    expect(
      publicationRefusal({
        categoryKey: NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
        behaviour: { channels: [IN_APP, EMAIL], classification: OPTIONAL, repeatIntervalDays: 7 },
        worded: all,
      }),
    ).toBeNull();
    expect(
      publicationRefusal({
        categoryKey: NOTIFICATION_CATEGORY.REPORT_DEADLINE,
        behaviour: { channels: [IN_APP, EMAIL], classification: OPTIONAL, leadTimesDays: [14, 7, 1] },
        worded: all,
      }),
    ).toBeNull();
  });

  it.each([
    ['a repeating category without its interval', NOTIFICATION_CATEGORY.OUTSTANDING_REPORT, {}, 'cadence_missing'],
    ['a counting-down category without its lead times', NOTIFICATION_CATEGORY.REPORT_DEADLINE, {}, 'cadence_missing'],
    [
      'lead times on the repeating category',
      NOTIFICATION_CATEGORY.OUTSTANDING_REPORT,
      { repeatIntervalDays: 7, leadTimesDays: [7] },
      'cadence_not_kept',
    ],
    ['an interval on the counting-down category', NOTIFICATION_CATEGORY.REPORT_DEADLINE, { repeatIntervalDays: 7 }, 'cadence_not_kept'],
    ['an interval on a category that keeps no cadence', NOTIFICATION_CATEGORY.MANUAL_REMINDER, { repeatIntervalDays: 7 }, 'cadence_not_kept'],
  ] as const)('refuses %s (task 51.2)', (_case, categoryKey, cadence, refusal) => {
    expect(
      publicationRefusal({ categoryKey, behaviour: { channels: [IN_APP], classification: OPTIONAL, ...cadence }, worded: all }),
    ).toBe(refusal);
  });

  it('refuses a channel a catalogue has no wording for', () => {
    expect(
      publicationRefusal({
        categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
        behaviour: { channels: [IN_APP, EMAIL], classification: OPTIONAL },
        worded: (channel) => channel === IN_APP,
      }),
    ).toBe('wording_missing');
  });
});
