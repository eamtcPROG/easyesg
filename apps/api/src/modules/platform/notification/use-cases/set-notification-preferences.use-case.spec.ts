import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NotificationPreferenceNotOfferedError } from '../errors/notification.errors';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import {
  FakeNotificationPreferenceStore,
  REMINDER_EMAIL,
  REMINDER_IN_APP,
  reminderTravellingOn,
} from '../testing/notification-preference-store.fake';
import { SetNotificationPreferences } from './set-notification-preferences.use-case';

const ACCOUNT = '0192f000-0000-7000-8000-00000000a001';

/** S-27's save (task 52.1; FR-163, BR-NOT-2; §12.5.6's task-52.1 row (4)). The reminder travels in-app alone here, so a channel it does not travel on has one to refuse. */
describe('SetNotificationPreferences (task 52.1)', () => {
  it('stores a switch-off and answers the read with it', async () => {
    const store = new FakeNotificationPreferenceStore();
    const answered = await new SetNotificationPreferences(store, reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP)).execute({
      accountId: ACCOUNT,
      switchedOff: [REMINDER_IN_APP],
    });

    expect(await store.switchedOff()).toEqual([REMINDER_IN_APP]);
    expect(answered.find((category) => category.categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER)?.channels).toEqual(
      [{ channel: 'in_app', enabled: false }],
    );
  });

  it('refuses a mandatory category whole, and writes nothing', async () => {
    const store = new FakeNotificationPreferenceStore();

    await expect(
      new SetNotificationPreferences(store, reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP)).execute({
        accountId: ACCOUNT,
        switchedOff: [
          REMINDER_IN_APP,
          { categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET, channel: NOTIFICATION_CHANNEL.EMAIL },
        ],
      }),
    ).rejects.toBeInstanceOf(NotificationPreferenceNotOfferedError);
    expect(store.replaced).toEqual([]);
  });

  it('refuses a channel the category does not travel on', async () => {
    const store = new FakeNotificationPreferenceStore();

    await expect(
      new SetNotificationPreferences(store, reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP)).execute({
        accountId: ACCOUNT,
        switchedOff: [REMINDER_EMAIL],
      }),
    ).rejects.toBeInstanceOf(NotificationPreferenceNotOfferedError);
    expect(store.replaced).toEqual([]);
  });

  // Refused on either of two grounds — it is operator-only and mandatory; which one excludes it from the read is
  // `offered-preferences.spec.ts`'s exact list (task 52's close review).
  it('refuses the operators’ invitation', async () => {
    await expect(
      new SetNotificationPreferences(new FakeNotificationPreferenceStore(), reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP)).execute({
        accountId: ACCOUNT,
        switchedOff: [{ categoryKey: NOTIFICATION_CATEGORY.ADMIN_INVITATION, channel: NOTIFICATION_CHANNEL.EMAIL }],
      }),
    ).rejects.toBeInstanceOf(NotificationPreferenceNotOfferedError);
  });

  it('switches back on what the write leaves out, among the pairs it offers', async () => {
    const store = new FakeNotificationPreferenceStore([REMINDER_IN_APP]);
    await new SetNotificationPreferences(store, reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP)).execute({
      accountId: ACCOUNT,
      switchedOff: [],
    });

    expect(await store.switchedOff()).toEqual([]);
  });

  it('offers the store only the switchable pairs, so a switch-off it does not offer stands', async () => {
    const store = new FakeNotificationPreferenceStore([REMINDER_EMAIL]);
    await new SetNotificationPreferences(store, reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP)).execute({
      accountId: ACCOUNT,
      switchedOff: [],
    });

    expect(store.replaced[0]?.offered).toEqual([REMINDER_IN_APP]);
    expect(await store.switchedOff()).toEqual([REMINDER_EMAIL]);
  });

  it('stores a pair named twice once', async () => {
    const store = new FakeNotificationPreferenceStore();
    await new SetNotificationPreferences(store, reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP)).execute({
      accountId: ACCOUNT,
      switchedOff: [REMINDER_IN_APP, { ...REMINDER_IN_APP }],
    });

    expect(store.replaced[0]?.switchedOff).toEqual([REMINDER_IN_APP]);
  });
});
