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
