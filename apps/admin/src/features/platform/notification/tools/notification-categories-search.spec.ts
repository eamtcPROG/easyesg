import { describe, expect, it } from 'vitest';
import { readNotificationCategoriesSearch, withCategory } from './notification-categories-search';

describe('A-17’s addressable state (task 67.10)', () => {
  it('keeps a category this release raises', () => {
    expect(readNotificationCategoriesSearch({ category: 'reporting.manual_reminder' })).toEqual({
      category: 'reporting.manual_reminder',
    });
  });

  it('drops a value it does not understand, so the list shows rather than an error', () => {
    expect(readNotificationCategoriesSearch({ category: 'reporting.unknown' })).toEqual({});
    expect(readNotificationCategoriesSearch({ category: 7 })).toEqual({});
  });

  it('opens and closes a record', () => {
    const open = withCategory({}, 'identity.invitation');
    expect(open).toEqual({ category: 'identity.invitation' });
    expect(withCategory(open, null)).toEqual({});
  });
});
