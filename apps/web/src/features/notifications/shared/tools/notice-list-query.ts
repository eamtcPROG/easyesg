import { SORT_DIRECTION, type ListQuery } from '@/lib/pagination';

/**
 * Which notices a view shows, and the list query that asks the API for them (tasks 50.2.1, 50.2.2; §12.5.6's task-50.2
 * row (4)) — S-26's two tabs and the panel's two.
 *
 * **In `shared/` on one test: is it read by more than one surface?** S-26 and the panel both show *unread* or *all*,
 * and both ask the same route the same way; how many rows a view takes, and whether it may start from the oldest, are
 * each surface's own.
 */
export const NOTICE_SHOW = {
  UNREAD: 'unread',
  ALL: 'all',
} as const;

export type NoticeShow = (typeof NOTICE_SHOW)[keyof typeof NOTICE_SHOW];

const SHOWS: readonly string[] = Object.values(NOTICE_SHOW);

/** Whether an unvalidated value names a view — beside the vocabulary it narrows to. */
export const isNoticeShow = (value: unknown): value is NoticeShow => typeof value === 'string' && SHOWS.includes(value);

/**
 * Which end of the centre a list starts from (§12.5.6's task-50.2 row (6)): S-26's choice, newest first unless the
 * reader asks otherwise. The panel is a glance at what arrived last, so it is always newest first. Declared here,
 * beside the query that spells it for the API.
 */
export const NOTICE_ORDER = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
} as const;

export type NoticeOrder = (typeof NOTICE_ORDER)[keyof typeof NOTICE_ORDER];

const ORDERS: readonly string[] = Object.values(NOTICE_ORDER);

/** Whether an unvalidated value names an order. */
export const isNoticeOrder = (value: unknown): value is NoticeOrder =>
  typeof value === 'string' && ORDERS.includes(value);

/**
 * The API's spelling of the centre's facet and order (`NOTIFICATION_CENTRE_FILTER`, `NOTIFICATION_READ_STATE` and
 * `NOTIFICATION_CENTRE_SORT` in `apps/api`) — written once here, where the query is built.
 */
const WIRE = {
  READ_FACET: 'read',
  UNREAD: 'unread',
  RECEIVED: 'received',
} as const;

/** A view as the API's compact list query — newest first stated even where it is the API's default. */
export const noticeListQuery = (input: {
  readonly show: NoticeShow;
  readonly order: NoticeOrder;
  /** 1-based. */
  readonly page: number;
  readonly onpage: number;
}): ListQuery => ({
  filters: input.show === NOTICE_SHOW.UNREAD ? [{ field: WIRE.READ_FACET, values: [WIRE.UNREAD] }] : [],
  order: [
    {
      field: WIRE.RECEIVED,
      direction: input.order === NOTICE_ORDER.OLDEST ? SORT_DIRECTION.ASC : SORT_DIRECTION.DESC,
    },
  ],
  page: input.page,
  onpage: input.onpage,
});
