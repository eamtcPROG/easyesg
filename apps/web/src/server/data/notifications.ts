import 'server-only';
import type { NotificationItem, NotificationPreferences, UnreadCount } from '@easyesg/contracts';
import type { IndexPage } from '@easyesg/ui';
import { API_OUTCOME } from '@/lib/api-outcome';
import { centreCategories, type CentreCategory } from '@/features/notifications/centre/tools/centre-categories';
import {
  centreListQuery,
  type CentreView,
} from '@/features/notifications/centre/tools/centre-view';
import { api } from '../api/api-client';
import { TENANT_READ, isPermissionRefusal, type TenantReadRefusal } from './tenant-read';

/**
 * S-26's read — one page of the recipient's centre, and their unread count (task 50.2.1; UC-165, FR-161).
 *
 * **Two calls, in parallel, and the second is not the first's to answer.** The page is filtered by the tab, so on
 * *All* its counts say nothing about what is unread — and the unread count is what the *Unread* tab and the heading
 * both show. It is the same statement the global tier polls, so the screen and the band cannot disagree about it.
 *
 * **A partial failure is a failure**, S-16's rule: a list without its count, or a count without its list, would
 * draw half of the centre as though it were the whole.
 *
 * **`total` is the centre before the tab and `matched` after it** — the Index archetype's two counts, which is what
 * tells *nothing has arrived yet* from *nothing unread* (§4.6).
 *
 * **And since task 37.3 the person's preferences, for the category filter's choices** — a third call in the same
 * parallel batch, since none feeds another. **Its failure is not the centre's**: the list and the count are what S-26
 * is, and the filter is a way through them, so a preferences read that failed draws the centre without the filter
 * rather than draw no centre at all.
 */
export { TENANT_READ as CENTRE_READ } from './tenant-read';

export type CentreRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly page: IndexPage<NotificationItem>;
      readonly unread: number;
      /** The category filter's choices, empty where there is nothing to choose between or the read failed. */
      readonly categories: readonly CentreCategory[];
    }
  | TenantReadRefusal;

export const readNotificationCentre = async (view: CentreView): Promise<CentreRead> => {
  const [listed, counted, preferences] = await Promise.all([
    api.getList<NotificationItem>('/notifications', centreListQuery(view)),
    api.get<UnreadCount>('/notifications/unread-count'),
    api.get<NotificationPreferences>('/account/notification-preferences'),
  ]);

  // An account acting for no organization is refused both; the screen answers that as it answers any tenant screen.
  if (isPermissionRefusal(listed) || isPermissionRefusal(counted)) return { status: TENANT_READ.FORBIDDEN };
  if (listed.status !== API_OUTCOME.Ok || counted.status !== API_OUTCOME.Ok) {
    return { status: TENANT_READ.UNREACHABLE };
  }

  return {
    status: TENANT_READ.READY,
    page: {
      rows: listed.value.items,
      matched: listed.value.total,
      // The route filters, so the API answers `unfiltered`; `total` stands in only if a future answer omits it.
      total: listed.value.unfiltered ?? listed.value.total,
      page: view.page,
      pageSize: view.pageSize,
    },
    unread: counted.value.unread,
    categories:
      preferences.status === API_OUTCOME.Ok && preferences.value !== null ? centreCategories(preferences.value) : [],
  };
};
