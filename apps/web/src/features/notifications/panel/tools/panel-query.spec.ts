import { describe, expect, it } from 'vitest';
import { NOTICE_SHOW } from '../../shared/tools/notice-list-query';
import { PANEL_SIZE, panelListQuery } from './panel-query';

/** The panel's glance (task 50.2.2): the first ten of a view, newest first. */
describe('panelListQuery', () => {
  it('asks for the latest ten of the view, on the first page only', () => {
    expect(PANEL_SIZE).toBe(10);
    expect(panelListQuery(NOTICE_SHOW.UNREAD)).toMatchObject({ page: 1, onpage: 10 });
    expect(panelListQuery(NOTICE_SHOW.UNREAD).filters).toEqual([{ field: 'read', values: ['unread'] }]);
    expect(panelListQuery(NOTICE_SHOW.ALL).filters).toEqual([]);
  });

  it('is always newest first — the other order is the page’s alone', () => {
    expect(panelListQuery(NOTICE_SHOW.ALL).order).toEqual([{ field: 'received', direction: 'desc' }]);
  });
});
