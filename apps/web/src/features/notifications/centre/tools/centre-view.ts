import { SORT_DIRECTION, type ListQuery } from '@/lib/pagination';

/**
 * S-26's view — which notices, and which page — read from the address, and the list query it asks the API
 * (task 50.2.1; UC-165; §12.5.6's task-50.2 row (4)).
 *
 * **The address is the state** (UX-4): a tab chosen and a page turned are `?show=` and `?page=`, so Back moves
 * them and a colleague opening the link sees the same list. **Read state alone for now**: the category filter
 * waits until two categories can reach the centre, and the API's category facet is simply not sent.
 *
 * **Unread first, as both artboards draw it** — a centre is opened to see what has not been read yet — so the bare
 * address is the unread tab, and `?show=all` the other.
 */
export const CENTRE_SHOW = {
  UNREAD: 'unread',
  ALL: 'all',
} as const;

export type CentreShow = (typeof CENTRE_SHOW)[keyof typeof CENTRE_SHOW];

/** Notices per page. The API's own default is larger; a page here is what a reader scans before deciding. */
export const CENTRE_PAGE_SIZE = 20;

export interface CentreView {
  readonly show: CentreShow;
  /** 1-based. */
  readonly page: number;
}

export const DEFAULT_CENTRE_VIEW: CentreView = { show: CENTRE_SHOW.UNREAD, page: 1 };

/**
 * The API's spelling of the centre's facet and order (`NOTIFICATION_CENTRE_FILTER`, `NOTIFICATION_READ_STATE` and
 * `NOTIFICATION_CENTRE_SORT` in `apps/api`) — written once here, where the query is built, the way S-16's list
 * names its own fields.
 */
const WIRE = {
  READ_FACET: 'read',
  UNREAD: 'unread',
  RECEIVED: 'received',
} as const;

const SHOWS: readonly string[] = Object.values(CENTRE_SHOW);

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
  const page = Number.parseInt(single('page') ?? '', 10);
  return {
    show: show !== undefined && SHOWS.includes(show) ? (show as CentreShow) : DEFAULT_CENTRE_VIEW.show,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_CENTRE_VIEW.page,
  };
};

/** The query string for a view, omitting what equals the default, so the bare address and the default view are one. */
export const centreViewQuery = (view: CentreView): string => {
  const params = new URLSearchParams();
  if (view.show !== DEFAULT_CENTRE_VIEW.show) params.set('show', view.show);
  if (view.page !== DEFAULT_CENTRE_VIEW.page) params.set('page', String(view.page));
  return params.toString();
};

/** The view as the API's compact list query — newest first, which is also the API's default, stated anyway. */
export const centreListQuery = (view: CentreView): ListQuery => ({
  filters: view.show === CENTRE_SHOW.UNREAD ? [{ field: WIRE.READ_FACET, values: [WIRE.UNREAD] }] : [],
  order: [{ field: WIRE.RECEIVED, direction: SORT_DIRECTION.DESC }],
  page: view.page,
  onpage: CENTRE_PAGE_SIZE,
});
