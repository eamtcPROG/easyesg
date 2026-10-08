import { NOTIFICATION_CHANNEL, NOTIFICATION_CLASSIFICATION } from '../models/notification-category.model';
import { sameBehaviour } from './same-behaviour';

/** A-17's *unchanged* (task 67.10): the channels as a set, the classification exactly. */
describe('sameBehaviour (task 67.10)', () => {
  const { EMAIL, IN_APP } = NOTIFICATION_CHANNEL;
  const { OPTIONAL, TRANSACTIONAL } = NOTIFICATION_CLASSIFICATION;

  it('reads channels in another order as the same', () => {
    expect(
      sameBehaviour(
        { channels: [IN_APP, EMAIL], classification: OPTIONAL },
        { channels: [EMAIL, IN_APP], classification: OPTIONAL },
      ),
    ).toBe(true);
  });

  it.each([
    ['a channel fewer', { channels: [EMAIL], classification: OPTIONAL }],
    ['a different channel', { channels: [IN_APP, IN_APP], classification: OPTIONAL }],
    ['another classification', { channels: [IN_APP, EMAIL], classification: TRANSACTIONAL }],
  ] as const)('tells %s apart', (_case, other) => {
    expect(sameBehaviour({ channels: [IN_APP, EMAIL], classification: OPTIONAL }, other)).toBe(false);
  });

  it('reads lead times in another order as the same, and tells a moved cadence apart (task 51.2)', () => {
    const counting = { channels: [IN_APP], classification: OPTIONAL, leadTimesDays: [14, 7, 1] } as const;
    expect(sameBehaviour(counting, { ...counting, leadTimesDays: [1, 7, 14] })).toBe(true);
    expect(sameBehaviour(counting, { ...counting, leadTimesDays: [14, 7] })).toBe(false);
    expect(sameBehaviour(counting, { channels: [IN_APP], classification: OPTIONAL })).toBe(false);

    const repeating = { channels: [IN_APP], classification: OPTIONAL, repeatIntervalDays: 7 } as const;
    expect(sameBehaviour(repeating, { ...repeating, repeatIntervalDays: 14 })).toBe(false);
    expect(sameBehaviour(repeating, { channels: [IN_APP], classification: OPTIONAL })).toBe(false);
  });
});
