import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import {
  FakeNotificationPreferenceStore,
  plainTokens,
  REMINDER_EMAIL,
  reminderTravellingOn,
} from '../testing/notification-preference-store.fake';
import { PreviewUnsubscribe } from './preview-unsubscribe.use-case';

const ACCOUNT = '0192f000-0000-7000-8000-00000000a001';

/** S-38's read (task 52.2.2): three standings, and nothing written on any of them. */
describe('PreviewUnsubscribe (task 52.2.2)', () => {
  const token = plainTokens.sign({ accountId: ACCOUNT, ...REMINDER_EMAIL });
  const optional = reminderTravellingOn(NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL);

  it('offers the switch while the category still reaches the person by email', async () => {
    const store = new FakeNotificationPreferenceStore();
    expect(await new PreviewUnsubscribe(plainTokens, optional, store).execute({ token })).toEqual({
      standing: 'available',
      categoryKey: 'reporting.manual_reminder',
    });
    expect(await store.switchedOff()).toEqual([]);
  });

  it('says it is already switched off', async () => {
    const store = new FakeNotificationPreferenceStore([REMINDER_EMAIL]);
    expect((await new PreviewUnsubscribe(plainTokens, optional, store).execute({ token })).standing).toBe(
      'switched_off',
    );
  });

  it('calls an unsigned link unusable, and names no category', async () => {
    expect(
      await new PreviewUnsubscribe(plainTokens, optional, new FakeNotificationPreferenceStore()).execute({
        token: 'forged',
      }),
    ).toEqual({ standing: 'unusable' });
  });
});
