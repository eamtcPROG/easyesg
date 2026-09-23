import { describe, expect, it } from 'vitest';
import { countMoved, settleUnreadCount } from './unread-count-state';

/** The poll's run of failures, kept across polls (task 50.2.1) — what OQ-36's backoff reads. */
describe('settleUnreadCount', () => {
  it('takes the count a poll read, and clears the run of failures', () => {
    expect(settleUnreadCount({ previous: { unread: 2, failures: 3 }, read: 5 })).toEqual({ unread: 5, failures: 0 });
  });

  it('keeps the count it last knew through a failed poll, and counts the failure', () => {
    const once = settleUnreadCount({ previous: { unread: 2, failures: 0 }, read: null });
    expect(once).toEqual({ unread: 2, failures: 1 });
    expect(settleUnreadCount({ previous: once, read: null })).toEqual({ unread: 2, failures: 2 });
  });

  it('knows no count until one poll has succeeded', () => {
    expect(settleUnreadCount({ previous: undefined, read: null })).toEqual({ unread: null, failures: 1 });
    expect(settleUnreadCount({ previous: undefined, read: 0 })).toEqual({ unread: 0, failures: 0 });
  });
});

/** The panel's floor (task 150): its lists are read again when the count answers a different number. */
describe('countMoved', () => {
  it('moves when a read answers a different number from the one before', () => {
    expect(countMoved({ previous: { unread: 2, failures: 0 }, next: { unread: 3, failures: 0 } })).toBe(true);
    expect(countMoved({ previous: { unread: 2, failures: 0 }, next: { unread: 0, failures: 0 } })).toBe(true);
  });

  it('does not move when the number is the same', () => {
    expect(countMoved({ previous: { unread: 2, failures: 1 }, next: { unread: 2, failures: 0 } })).toBe(false);
  });

  it('does not move on a first read, or on a failed one that kept the last number', () => {
    expect(countMoved({ previous: undefined, next: { unread: 4, failures: 0 } })).toBe(false);
    expect(countMoved({ previous: { unread: null, failures: 1 }, next: { unread: 4, failures: 0 } })).toBe(false);
    expect(countMoved({ previous: { unread: 2, failures: 0 }, next: { unread: 2, failures: 1 } })).toBe(false);
  });
});
