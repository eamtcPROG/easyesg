import type { ListQuery } from '@/lib/pagination';
import {
  NOTICE_ORDER,
  NOTICE_SHOW,
  isNoticeOrder,
  isNoticeShow,
  noticeListQuery,
  type NoticeOrder,
  type NoticeShow,
} from '../../shared/tools/notice-list-query';

/**
 * S-26's view — which notices, in which order, and which page — read from the address, and the list query it asks
 * the API (task 50.2.1; UC-165; §12.5.6's task-50.2 rows (4), (6)).
 *
 * **The address is the state** (UX-4): a tab chosen, an order chosen and a page turned are `?show=`, `?order=` and
 * `?page=`, so Back moves them and a colleague opening the link sees the same list. **Newest first** unless the reader
 * asks for the oldest. **Unread first, as both artboards draw it** — a centre is
 * opened to see what has not been read yet — so the bare address is the unread tab, and `?show=all` the other. Which
 * notices a view shows, and how the API is asked for them, are the panel's too (`shared/tools/notice-list-query.ts`).
 */

/** Notices per page. The API's own default is larger; a page here is what a reader scans before deciding. */
export const CENTRE_PAGE_SIZE = 20;

export interface CentreView {
  readonly show: NoticeShow;
  readonly order: NoticeOrder;
  /** 1-based. */
  readonly page: number;
}

export const DEFAULT_CENTRE_VIEW: CentreView = { show: NOTICE_SHOW.UNREAD, order: NOTICE_ORDER.NEWEST, page: 1 };

/**
 * The view, read from the address and never trusted: an unreadable parameter falls back to the default rather than
 * erroring, since a stale or hand-edited query string should show the centre, not a screen about the query string.
 */
export const readCentreView = (params: Record<string, string | string[] | undefined>): CentreView => {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const show = single('show');
  const order = single('order');
  const page = Number.parseInt(single('page') ?? '', 10);
  return {
    show: isNoticeShow(show) ? show : DEFAULT_CENTRE_VIEW.show,
    order: isNoticeOrder(order) ? order : DEFAULT_CENTRE_VIEW.order,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_CENTRE_VIEW.page,
  };
};

/** The query string for a view, omitting what equals the default, so the bare address and the default view are one. */
export const centreViewQuery = (view: CentreView): string => {
  const params = new URLSearchParams();
  if (view.show !== DEFAULT_CENTRE_VIEW.show) params.set('show', view.show);
  if (view.order !== DEFAULT_CENTRE_VIEW.order) params.set('order', view.order);
  if (view.page !== DEFAULT_CENTRE_VIEW.page) params.set('page', String(view.page));
  return params.toString();
};

/** The view as the API's list query, a page at a time. */
export const centreListQuery = (view: CentreView): ListQuery =>
  noticeListQuery({ show: view.show, order: view.order, page: view.page, onpage: CENTRE_PAGE_SIZE });
