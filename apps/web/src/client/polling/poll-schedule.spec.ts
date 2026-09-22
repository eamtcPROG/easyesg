import { describe, expect, it } from 'vitest';
import { POLL_BACKOFF_CAP, nextPollDelay } from './poll-schedule';

/** OQ-36's schedule (task 50.2.1): the interval while a poll succeeds, full-jitter exponential after it fails. */
describe('nextPollDelay', () => {
  it('waits the interval while the poll succeeds', () => {
    expect(nextPollDelay({ interval: 60_000, failures: 0, random: () => 0 })).toBe(60_000);
  });

  it('draws from zero up to the interval doubled per failure', () => {
    expect(nextPollDelay({ interval: 60_000, failures: 1, random: () => 0 })).toBe(0);
    expect(nextPollDelay({ interval: 60_000, failures: 1, random: () => 0.5 })).toBe(60_000);
    expect(nextPollDelay({ interval: 60_000, failures: 2, random: () => 0.5 })).toBe(120_000);
  });

  it('never waits past the five-minute cap, however long the failures run', () => {
    expect(nextPollDelay({ interval: 60_000, failures: 30, random: () => 0.999_999 })).toBeLessThan(POLL_BACKOFF_CAP);
    expect(nextPollDelay({ interval: 60_000, failures: 3, random: () => 0.999_999 })).toBe(299_999);
  });
});
