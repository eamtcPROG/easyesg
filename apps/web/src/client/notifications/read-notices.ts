import { readResultList, type NotificationItem } from '@easyesg/contracts';
import { buildListQuery, type ListQuery } from '@/lib/pagination';

/**
 * `GET /api/v1/notifications` from the browser, through the token-attaching pass-through (task 50.2.2) — the panel's
 * list, read when the bell is pressed rather than on every navigation.
 *
 * **It answers the page or `null`, never throws**, the count's reason: the panel draws its own *could not load* state
 * from `null`, with a way to try again. The envelope is validated, never cast (`readResultList`), and `unfiltered` —
 * the centre before the tab — falls back to `total` only if an answer omits it.
 */
export interface NoticesPage {
  readonly items: readonly NotificationItem[];
  /** Notices the view admits. */
  readonly matched: number;
  /** Notices in the centre before the view — what tells *nothing yet* from *nothing unread*. */
  readonly total: number;
}

const NOTICES_PASS_THROUGH = '/api/v1/notifications';

export async function readNotices(input: {
  readonly query: ListQuery;
  readonly fetch?: typeof fetch;
}): Promise<NoticesPage | null> {
  const send = input.fetch ?? fetch;
  const search = buildListQuery(input.query);
  try {
    const response = await send(search ? `${NOTICES_PASS_THROUGH}?${search}` : NOTICES_PASS_THROUGH, {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const list = readResultList<NotificationItem>(await response.json(), NOTICES_PASS_THROUGH);
    return { items: list.items, matched: list.total, total: list.unfiltered ?? list.total };
  } catch {
    return null;
  }
}
