import { readNotificationCategory } from './notification-category';

/**
 * A `notification_category` payload read as behaviour (task 49.1). Literals on purpose: these are the values
 * an operator publishes, and the spec must break if a vocabulary member's spelling moves under them.
 */
describe('readNotificationCategory (task 49.1)', () => {
  it('reads the channels and the classification', () => {
    expect(
      readNotificationCategory({ channels: ['in_app', 'email'], classification: 'optional' }),
    ).toEqual({ channels: ['in_app', 'email'], classification: 'optional' });
  });

  // Forward-compatible for 51.2's cadence, which a replica may meet before its release reads it.
  it('ignores a member it does not know', () => {
    expect(
      readNotificationCategory({ channels: ['email'], classification: 'transactional', repeatIntervalDays: 7 }),
    ).toEqual({ channels: ['email'], classification: 'transactional' });
  });

  it.each([
    ['no channel list', { classification: 'transactional' }],
    ['an empty channel list', { channels: [], classification: 'transactional' }],
    ['a channel list that is not a list', { channels: 'email', classification: 'transactional' }],
    ['an unknown channel beside known ones', { channels: ['email', 'sms'], classification: 'transactional' }],
    ['a channel named twice', { channels: ['email', 'email'], classification: 'transactional' }],
    ['no classification', { channels: ['email'] }],
    ['an unknown classification', { channels: ['email'], classification: 'mandatory' }],
  ])('refuses a payload with %s, whole', (_label, payload) => {
    expect(readNotificationCategory(payload)).toBeNull();
  });
});
