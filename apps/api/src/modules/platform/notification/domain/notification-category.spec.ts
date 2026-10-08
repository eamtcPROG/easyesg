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

  // Forward-compatible, so a later release's member can be published before every replica reads it.
  it('ignores a member it does not know', () => {
    expect(
      readNotificationCategory({ channels: ['email'], classification: 'transactional', quietHours: [22, 7] }),
    ).toEqual({ channels: ['email'], classification: 'transactional' });
  });

  it('reads a repeat interval, and lead times longest first (task 51.2)', () => {
    expect(
      readNotificationCategory({ channels: ['in_app'], classification: 'optional', repeatIntervalDays: 7 }),
    ).toEqual({ channels: ['in_app'], classification: 'optional', repeatIntervalDays: 7 });
    expect(
      readNotificationCategory({ channels: ['in_app'], classification: 'optional', leadTimesDays: [1, 14, 7] }),
    ).toEqual({ channels: ['in_app'], classification: 'optional', leadTimesDays: [14, 7, 1] });
  });

  it.each([
    ['a repeat interval of zero days', { repeatIntervalDays: 0 }],
    ['a repeat interval of part of a day', { repeatIntervalDays: 3.5 }],
    ['a repeat interval past a year', { repeatIntervalDays: 366 }],
    ['a repeat interval written as text', { repeatIntervalDays: '7' }],
    ['lead times that are not a list', { leadTimesDays: 7 }],
    ['no lead times at all', { leadTimesDays: [] }],
    ['a lead time named twice', { leadTimesDays: [7, 7] }],
    ['a lead time of zero days', { leadTimesDays: [14, 0] }],
    ['thirteen lead times', { leadTimesDays: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }],
  ])('refuses a payload with %s, whole', (_label, cadence) => {
    expect(readNotificationCategory({ channels: ['in_app'], classification: 'optional', ...cadence })).toBeNull();
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
