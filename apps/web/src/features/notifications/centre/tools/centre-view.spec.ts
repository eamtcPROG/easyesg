import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CENTRE_VIEW,
  centreListQuery,
  centreViewQuery,
  readCentreView,
} from './centre-view';
import { NOTICE_ORDER, NOTICE_SHOW } from '../../shared/tools/notice-list-query';

/** S-26's view (task 50.2.1): read off the address, never trusted, and asked of the API as its compact list query. */
describe('the centre view', () => {
  it('opens on the unread notices, first page, at the bare address', () => {
    expect(readCentreView({})).toEqual({ show: 'unread', order: 'newest', page: 1, pageSize: 25, category: null });
    expect(centreViewQuery(DEFAULT_CENTRE_VIEW)).toBe('');
  });

  it('reads the tab, the order and the page, and writes back only what is not the default', () => {
    const view = readCentreView({ show: 'all', order: 'oldest', page: '3', onpage: '50' });
    expect(view).toEqual({ show: NOTICE_SHOW.ALL, order: NOTICE_ORDER.OLDEST, page: 3, pageSize: 50, category: null });
    expect(centreViewQuery(view)).toBe('show=all&order=oldest&page=3&onpage=50');
    expect(centreViewQuery({ ...DEFAULT_CENTRE_VIEW, order: NOTICE_ORDER.OLDEST })).toBe('order=oldest');
  });

  it.each([
    ['an unknown tab', { show: 'archived' }],
    ['an unknown order', { order: 'received' }],
    ['a page that is not a number', { page: 'two' }],
    ['a page below the first', { page: '0' }],
    ['a repeated parameter, whose first value is unknown', { show: ['nope', 'all'] }],
    ['a page size the centre does not offer', { onpage: '20' }],
    ['a category nobody declared', { category: 'billing.nothing' }],
  ])('falls back to the default for %s', (_case, params) => {
    expect(readCentreView(params)).toEqual(DEFAULT_CENTRE_VIEW);
  });

  it('asks the API for unread notices only on the unread tab, newest first, a page at a time', () => {
    expect(centreListQuery({ ...DEFAULT_CENTRE_VIEW, page: 2 })).toEqual({
      filters: [{ field: 'read', values: ['unread'] }],
      order: [{ field: 'received', direction: 'desc' }],
      page: 2,
      // 25 by default since task 203.1 (UX-141); it was a fixed 20.
      onpage: 25,
    });
    expect(centreListQuery({ ...DEFAULT_CENTRE_VIEW, pageSize: 100 }).onpage).toBe(100);
    expect(centreListQuery({ ...DEFAULT_CENTRE_VIEW, show: NOTICE_SHOW.ALL }).filters).toEqual([]);
  });

  /** Task 37.3: the filter the second in-app category brought, an address like the tabs and a facet beside theirs. */
  it('reads a category, writes it back, and asks the API for it beside the read state', () => {
    const view = readCentreView({ category: 'reporting.report_update' });
    expect(view.category).toBe('reporting.report_update');
    expect(centreViewQuery(view)).toBe('category=reporting.report_update');
    expect(centreListQuery(view).filters).toEqual([
      { field: 'read', values: ['unread'] },
      { field: 'category', values: ['reporting.report_update'] },
    ]);
    expect(centreListQuery({ ...view, show: NOTICE_SHOW.ALL }).filters).toEqual([
      { field: 'category', values: ['reporting.report_update'] },
    ]);
  });

  it('asks the API for the oldest first when the reader chose it', () => {
    expect(centreListQuery({ ...DEFAULT_CENTRE_VIEW, show: NOTICE_SHOW.ALL, order: NOTICE_ORDER.OLDEST }).order).toEqual([
      { field: 'received', direction: 'asc' },
    ]);
  });
});
