import type { ListQuery } from '@/lib/pagination';
import { NOTICE_ORDER, noticeListQuery, type NoticeShow } from '../../shared/tools/notice-list-query';

/**
 * What the panel asks for (task 50.2.2; §12.5.6's task-50.2 row's implementation notes): **the latest ten** of a
 * view, newest first, the first page and no other — the panel is a glance, and the page behind *All notifications* is
 * the list, which alone offers the other order (row (6)).
 */
export const PANEL_SIZE = 10;

export const panelListQuery = (show: NoticeShow): ListQuery => noticeListQuery({ show, order: NOTICE_ORDER.NEWEST, page: 1, onpage: PANEL_SIZE });
