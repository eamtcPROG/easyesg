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
});
