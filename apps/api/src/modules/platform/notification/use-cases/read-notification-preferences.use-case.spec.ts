import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import {
  FakeNotificationPreferenceStore,
  REMINDER_EMAIL,
  reminderTravellingOn,
} from '../testing/notification-preference-store.fake';
import { ReadNotificationPreferences } from './read-notification-preferences.use-case';

const ACCOUNT = '0192f000-0000-7000-8000-00000000a001';

/** UC-168's read (task 52.1). What it offers is `offeredPreferences`' spec; this is that the store and the catalogue reach it. */
describe('ReadNotificationPreferences (task 52.1)', () => {
  it('reads the account’s switch-offs against the behaviour in force', async () => {
    const offered = await new ReadNotificationPreferences(
      new FakeNotificationPreferenceStore([REMINDER_EMAIL]),
      reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL),
    ).execute({ accountId: ACCOUNT });

    expect(offered.find((category) => category.categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER)?.channels).toEqual(
      [
        { channel: 'in_app', enabled: true },
        { channel: 'email', enabled: false },
      ],
    );
  });
});
