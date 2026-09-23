import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { UnsubscribeLinkUnusableError } from '../errors/notification.errors';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import {
  FakeNotificationPreferenceStore,
  plainTokens,
  REMINDER_EMAIL,
  REMINDER_IN_APP,
  reminderTravellingOn,
} from '../testing/notification-preference-store.fake';
import { Unsubscribe } from './unsubscribe.use-case';

const ACCOUNT = '0192f000-0000-7000-8000-00000000a001';

/** FR-169's switch (task 52.2.2): one pair off for the person the link names, and nothing else. */
describe('Unsubscribe (task 52.2.2)', () => {
  const token = plainTokens.sign({ accountId: ACCOUNT, ...REMINDER_EMAIL });
  const optional = reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL);

  it('switches the link’s category off on its channel, and leaves the rest as it stands', async () => {
    const store = new FakeNotificationPreferenceStore([REMINDER_IN_APP]);
    const answer = await new Unsubscribe(plainTokens, optional, store).execute({ token });

    expect(answer).toEqual({ standing: 'switched_off', categoryKey: 'reporting.manual_reminder' });
    expect(await store.switchedOff()).toEqual([REMINDER_IN_APP, REMINDER_EMAIL]);
  });

  it('succeeds again without writing twice', async () => {
    const store = new FakeNotificationPreferenceStore([REMINDER_EMAIL]);
    await new Unsubscribe(plainTokens, optional, store).execute({ token });

    expect(await store.switchedOff()).toEqual([REMINDER_EMAIL]);
  });

  it('refuses a link nobody signed, and writes nothing', async () => {
    const store = new FakeNotificationPreferenceStore();
    await expect(new Unsubscribe(plainTokens, optional, store).execute({ token: 'forged' })).rejects.toBeInstanceOf(
      UnsubscribeLinkUnusableError,
    );
    expect(await store.switchedOff()).toEqual([]);
  });

  it('refuses a link to a category that may no longer be switched off', async () => {
    const mandatory = plainTokens.sign({
      accountId: ACCOUNT,
      categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
      channel: NOTIFICATION_CHANNEL.EMAIL,
    });
    await expect(
      new Unsubscribe(plainTokens, optional, new FakeNotificationPreferenceStore()).execute({ token: mandatory }),
    ).rejects.toBeInstanceOf(UnsubscribeLinkUnusableError);
  });
});
