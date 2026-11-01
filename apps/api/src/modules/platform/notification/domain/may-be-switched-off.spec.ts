import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NOTIFICATION_CHANNEL, NOTIFICATION_CLASSIFICATION } from '../models/notification-category.model';
import { mayBeSwitchedOff } from './may-be-switched-off';

/** FR-163's one predicate (task 52.2): not mandatory in code, and classified optional in force. */
describe('mayBeSwitchedOff (task 52.2)', () => {
  const classified = (classification: (typeof NOTIFICATION_CLASSIFICATION)[keyof typeof NOTIFICATION_CLASSIFICATION]) => ({
    channels: [NOTIFICATION_CHANNEL.IN_APP],
    classification,
  });

  it('lets an optional category be switched off', () => {
    expect(
      mayBeSwitchedOff({
        categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
        behaviour: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL),
      }),
    ).toBe(true);
  });

  it('locks a category published as transactional that code does not declare mandatory', () => {
    expect(
      mayBeSwitchedOff({
        categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
        behaviour: classified(NOTIFICATION_CLASSIFICATION.TRANSACTIONAL),
      }),
    ).toBe(false);
  });

  it('locks a category whose behaviour cannot be read', () => {
    expect(mayBeSwitchedOff({ categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER, behaviour: null })).toBe(false);
  });

  it('locks a mandatory category whatever its artefact says', () => {
    expect(
      mayBeSwitchedOff({
        categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
        behaviour: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL),
      }),
    ).toBe(false);
  });
});
