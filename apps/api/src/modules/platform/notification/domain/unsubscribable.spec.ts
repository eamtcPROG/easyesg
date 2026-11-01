import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NOTIFICATION_CHANNEL, NOTIFICATION_CLASSIFICATION } from '../models/notification-category.model';
import { unsubscribable } from './unsubscribable';

/** What a followed link may switch off (task 52.2.2): a signed subject whose category is still optional. */
describe('unsubscribable (task 52.2.2)', () => {
  const SUBJECT = {
    accountId: '0192f000-0000-7000-8000-00000000a001',
    categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER,
    channel: NOTIFICATION_CHANNEL.EMAIL,
  };
  const classified =
    (classification: (typeof NOTIFICATION_CLASSIFICATION)[keyof typeof NOTIFICATION_CLASSIFICATION]) => () => ({
      channels: [NOTIFICATION_CHANNEL.EMAIL],
      classification,
    });

  it('answers a signed subject whose category may be switched off', () => {
    expect(unsubscribable({ subject: SUBJECT, behaviourOf: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL) })).toBe(
      SUBJECT,
    );
  });

  it('answers nothing for a token nobody signed', () => {
    expect(unsubscribable({ subject: null, behaviourOf: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL) })).toBeNull();
  });

  it('answers nothing once the category is no longer optional, whatever the link was minted under', () => {
    expect(
      unsubscribable({ subject: SUBJECT, behaviourOf: classified(NOTIFICATION_CLASSIFICATION.TRANSACTIONAL) }),
    ).toBeNull();
    expect(unsubscribable({ subject: SUBJECT, behaviourOf: () => null })).toBeNull();
  });
});
