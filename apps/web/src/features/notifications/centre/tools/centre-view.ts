import { isNotificationCategoryKey, type NotificationCategoryKey } from '@easyesg/contracts';
import { DEFAULT_PAGE_SIZE, readPageSize, type PageSize } from '@easyesg/ui';
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
 * `?page=`, so Back moves them and a colleague opening the link sees the same list — and since task 37.3 a category
 * chosen is `?category=`, the filter that arrived with the second category to travel in-app (§12.5.6's task-50.2 row
 * (7)). **Newest first** unless the reader
 * asks for the oldest. **Unread first, as both artboards draw it** — a centre is
 * opened to see what has not been read yet — so the bare address is the unread tab, and `?show=all` the other. Which
 * notices a view shows, and how the API is asked for them, are the panel's too (`shared/tools/notice-list-query.ts`).
 */

export interface CentreView {
  readonly show: NoticeShow;
  readonly order: NoticeOrder;
  /** 1-based. */
  readonly page: number;
  /**
   * UX-141's rows per page — 25, 50 or 100, `?onpage=` and absent at the default (task 203.1). It was a fixed 20 until
   * then; §4.7's row for S-26 gives the centre the same choice and default as every other tenant list.
   */
  readonly pageSize: PageSize;
  /** One category's notices, or `null` for every category — the default, and absent from the address. */
  readonly category: NotificationCategoryKey | null;
}

export const DEFAULT_CENTRE_VIEW: CentreView = {
  show: NOTICE_SHOW.UNREAD,
  order: NOTICE_ORDER.NEWEST,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  category: null,
};

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
  const category = single('category');
  return {
    show: isNoticeShow(show) ? show : DEFAULT_CENTRE_VIEW.show,
    order: isNoticeOrder(order) ? order : DEFAULT_CENTRE_VIEW.order,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_CENTRE_VIEW.page,
    pageSize: readPageSize(single('onpage')).onpage ?? DEFAULT_CENTRE_VIEW.pageSize,
    category: isNotificationCategoryKey(category) ? category : DEFAULT_CENTRE_VIEW.category,
  };
};

/** The query string for a view, omitting what equals the default, so the bare address and the default view are one. */
export const centreViewQuery = (view: CentreView): string => {
  const params = new URLSearchParams();
  if (view.show !== DEFAULT_CENTRE_VIEW.show) params.set('show', view.show);
  if (view.order !== DEFAULT_CENTRE_VIEW.order) params.set('order', view.order);
  if (view.page !== DEFAULT_CENTRE_VIEW.page) params.set('page', String(view.page));
  if (view.pageSize !== DEFAULT_CENTRE_VIEW.pageSize) params.set('onpage', String(view.pageSize));
  if (view.category !== null) params.set('category', view.category);
  return params.toString();
};

/** The view as the API's list query, a page at a time. */
export const centreListQuery = (view: CentreView): ListQuery =>
  noticeListQuery({
    show: view.show,
    order: view.order,
    page: view.page,
    onpage: view.pageSize,
    category: view.category,
  });
