import { describe, expect, it } from 'vitest';
import { NOTICE_ORDER, NOTICE_SHOW, isNoticeOrder, isNoticeShow, noticeListQuery } from './notice-list-query';

/** The list query S-26 and the panel share (tasks 50.2.1, 50.2.2). */
describe('noticeListQuery', () => {
  it('asks for unread notices only on the unread view, newest first, the page and size given', () => {
    expect(noticeListQuery({ show: NOTICE_SHOW.UNREAD, order: NOTICE_ORDER.NEWEST, page: 2, onpage: 20 })).toEqual({
      filters: [{ field: 'read', values: ['unread'] }],
      order: [{ field: 'received', direction: 'desc' }],
      page: 2,
      onpage: 20,
    });
    expect(noticeListQuery({ show: NOTICE_SHOW.ALL, order: NOTICE_ORDER.NEWEST, page: 1, onpage: 10 }).filters).toEqual(
      [],
    );
  });

  it('asks for the oldest first when the view says so', () => {
    expect(noticeListQuery({ show: NOTICE_SHOW.ALL, order: NOTICE_ORDER.OLDEST, page: 1, onpage: 10 }).order).toEqual([
      { field: 'received', direction: 'asc' },
    ]);
  });

  it('narrows a view off an unvalidated value', () => {
    expect(isNoticeShow('all')).toBe(true);
    expect(isNoticeShow('archived')).toBe(false);
    expect(isNoticeShow(undefined)).toBe(false);
  });

  it('narrows an order off an unvalidated value', () => {
    expect(isNoticeOrder('oldest')).toBe(true);
    expect(isNoticeOrder('received')).toBe(false);
    expect(isNoticeOrder(undefined)).toBe(false);
  });
});
