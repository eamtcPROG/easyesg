import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '@api/contracts/notification.port';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_CLASSIFICATION,
  type NotificationCategoryBehaviour,
} from '../models/notification-category.model';
import { offeredPreferences, switchablePairs } from './offered-preferences';

/** What S-27 offers (task 52.1; FR-163, BR-NOT-2; §12.5.6's task-52.1 row (3)). */
describe('offeredPreferences (task 52.1)', () => {
  const EMAIL_ONLY: NotificationCategoryBehaviour = {
    channels: [NOTIFICATION_CHANNEL.EMAIL],
    classification: NOTIFICATION_CLASSIFICATION.TRANSACTIONAL,
  };
  const REMINDER: NotificationCategoryBehaviour = {
    channels: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
    classification: NOTIFICATION_CLASSIFICATION.OPTIONAL,
  };

  /** The seed's behaviour, with the reminder on both channels so a switch-off has two to choose from. */
  const seeded = (categoryKey: NotificationCategoryKey): NotificationCategoryBehaviour | null =>
    categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER ? REMINDER : EMAIL_ONLY;

  it('lists every category a tenant account can receive, and not the operators’ invitation', () => {
    const offered = offeredPreferences({ behaviourOf: seeded, switchedOff: [] });

    expect(offered.map((category) => category.categoryKey)).toEqual([
      'identity.email_verification',
      'identity.password_reset',
      'identity.invitation',
      'reporting.manual_reminder',
    ]);
  });

  it('lists a mandatory category switched on and locked, even over a stored switch-off', () => {
    const offered = offeredPreferences({
      behaviourOf: seeded,
      switchedOff: [{ categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET, channel: NOTIFICATION_CHANNEL.EMAIL }],
    });

    expect(offered.find((category) => category.categoryKey === NOTIFICATION_CATEGORY.PASSWORD_RESET)).toEqual({
      categoryKey: 'identity.password_reset',
      mandatory: true,
      channels: [{ channel: 'email', enabled: true }],
    });
  });

  it('switches off exactly the pair stored, and leaves the category’s other channel on', () => {
    const offered = offeredPreferences({
      behaviourOf: seeded,
      switchedOff: [{ categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER, channel: NOTIFICATION_CHANNEL.EMAIL }],
    });

    expect(offered.find((category) => category.categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER)).toEqual({
      categoryKey: 'reporting.manual_reminder',
      mandatory: false,
      channels: [
        { channel: 'in_app', enabled: true },
        { channel: 'email', enabled: false },
      ],
    });
  });

  it('offers only the channels the category travels on, whatever is stored for another', () => {
    const offered = offeredPreferences({
      behaviourOf: (categoryKey) =>
        categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER
          ? { channels: [NOTIFICATION_CHANNEL.IN_APP], classification: NOTIFICATION_CLASSIFICATION.OPTIONAL }
          : EMAIL_ONLY,
      switchedOff: [{ categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER, channel: NOTIFICATION_CHANNEL.EMAIL }],
    });

    expect(offered.find((category) => category.categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER)?.channels).toEqual(
      [{ channel: 'in_app', enabled: true }],
    );
  });

  it('leaves out an optional category whose behaviour cannot be read, since it is sent on nothing', () => {
    const offered = offeredPreferences({
      behaviourOf: (categoryKey) => (categoryKey === NOTIFICATION_CATEGORY.MANUAL_REMINDER ? null : EMAIL_ONLY),
      switchedOff: [],
    });

    expect(offered.map((category) => category.categoryKey)).not.toContain('reporting.manual_reminder');
  });

  it('lists a mandatory category whose behaviour cannot be read on the email floor it is sent by', () => {
    const offered = offeredPreferences({ behaviourOf: () => null, switchedOff: [] });

    expect(offered).toEqual([
      { categoryKey: 'identity.email_verification', mandatory: true, channels: [{ channel: 'email', enabled: true }] },
      { categoryKey: 'identity.password_reset', mandatory: true, channels: [{ channel: 'email', enabled: true }] },
      { categoryKey: 'identity.invitation', mandatory: true, channels: [{ channel: 'email', enabled: true }] },
    ]);
  });
});

describe('switchablePairs (task 52.1)', () => {
  it('offers every channel of an optional category and nothing of a mandatory one', () => {
    expect(
      switchablePairs([
        { categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET, mandatory: true, channels: [{ channel: 'email', enabled: true }] },
        {
          categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
          mandatory: false,
          channels: [
            { channel: 'in_app', enabled: true },
            { channel: 'email', enabled: false },
          ],
        },
      ]),
    ).toEqual([
      { categoryKey: 'reporting.manual_reminder', channel: 'in_app' },
      { categoryKey: 'reporting.manual_reminder', channel: 'email' },
    ]);
  });
});
