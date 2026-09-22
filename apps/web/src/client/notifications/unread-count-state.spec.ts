import { describe, expect, it } from 'vitest';
import { settleUnreadCount } from './unread-count-state';

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
