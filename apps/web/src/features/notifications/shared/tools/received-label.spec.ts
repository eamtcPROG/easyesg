import { describe, expect, it } from 'vitest';
import { receivedLabel, type NoticeDateFormatter } from './received-label';

/**
 * A formatter keyed on an ISO date, so *the same day* is the formatter's answer — in production the request's
 * timezone decides it, and this stub lets the spec choose.
 */
const formatter: NoticeDateFormatter = {
  dateTime: (value, format) =>
    format === 'short'
      ? value.toISOString().slice(0, 10)
      : format === 'clock'
        ? value.toISOString().slice(11, 16)
        : `${value.toISOString().slice(0, 10)} ${value.toISOString().slice(11, 16)}`,
};
const today = (time: string) => `Today, ${time}`;

/** S-26's received time (task 50.2.1): the day in words when it is today, the date otherwise. */
describe('receivedLabel', () => {
  const now = new Date('2026-09-22T15:00:00Z');

  it('says today, with the time, for a notice from today', () => {
    expect(receivedLabel({ receivedAt: new Date('2026-09-22T09:02:00Z'), now, format: formatter, today })).toBe(
      'Today, 09:02',
    );
  });

  it('gives the date and time for a notice from any other day', () => {
    expect(receivedLabel({ receivedAt: new Date('2026-09-21T23:59:00Z'), now, format: formatter, today })).toBe(
      '2026-09-21 23:59',
    );
  });
});
