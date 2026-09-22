import { describe, expect, it } from 'vitest';
import {
  CENTRE_PAGE_SIZE,
  DEFAULT_CENTRE_VIEW,
  centreListQuery,
  centreViewQuery,
  readCentreView,
} from './centre-view';
import { NOTICE_ORDER, NOTICE_SHOW } from '../../shared/tools/notice-list-query';

/** S-26's view (task 50.2.1): read off the address, never trusted, and asked of the API as its compact list query. */
describe('the centre view', () => {
  it('opens on the unread notices, first page, at the bare address', () => {
    expect(readCentreView({})).toEqual({ show: 'unread', order: 'newest', page: 1 });
    expect(centreViewQuery(DEFAULT_CENTRE_VIEW)).toBe('');
  });

  it('reads the tab, the order and the page, and writes back only what is not the default', () => {
    const view = readCentreView({ show: 'all', order: 'oldest', page: '3' });
    expect(view).toEqual({ show: NOTICE_SHOW.ALL, order: NOTICE_ORDER.OLDEST, page: 3 });
    expect(centreViewQuery(view)).toBe('show=all&order=oldest&page=3');
    expect(centreViewQuery({ ...DEFAULT_CENTRE_VIEW, order: NOTICE_ORDER.OLDEST })).toBe('order=oldest');
  });

  it.each([
    ['an unknown tab', { show: 'archived' }],
    ['an unknown order', { order: 'received' }],
    ['a page that is not a number', { page: 'two' }],
    ['a page below the first', { page: '0' }],
    ['a repeated parameter, whose first value is unknown', { show: ['nope', 'all'] }],
  ])('falls back to the default for %s', (_case, params) => {
    expect(readCentreView(params)).toEqual(DEFAULT_CENTRE_VIEW);
  });

  it('asks the API for unread notices only on the unread tab, newest first, a page at a time', () => {
    expect(centreListQuery({ show: NOTICE_SHOW.UNREAD, order: NOTICE_ORDER.NEWEST, page: 2 })).toEqual({
      filters: [{ field: 'read', values: ['unread'] }],
      order: [{ field: 'received', direction: 'desc' }],
      page: 2,
      onpage: CENTRE_PAGE_SIZE,
    });
    expect(centreListQuery({ show: NOTICE_SHOW.ALL, order: NOTICE_ORDER.NEWEST, page: 1 }).filters).toEqual([]);
  });

  it('asks the API for the oldest first when the reader chose it', () => {
    expect(centreListQuery({ show: NOTICE_SHOW.ALL, order: NOTICE_ORDER.OLDEST, page: 1 }).order).toEqual([
      { field: 'received', direction: 'asc' },
    ]);
  });
});
