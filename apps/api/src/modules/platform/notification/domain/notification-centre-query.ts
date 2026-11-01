import { isNotificationCategoryKey, type NotificationCategoryKey } from '@api/contracts/notification.port';
import { SORT_DIRECTION, type ListQueryInput } from '@api/contracts/types/list-query';
import {
  NOTIFICATION_CENTRE_FILTER,
  NOTIFICATION_CENTRE_SORT,
  isNotificationReadState,
  type NotificationCentreQuery,
} from '../models/notification-centre.model';

/**
 * §6.8's compact list query, narrowed to what the centre can be asked (task 50.1.2; §12.5.6's task-50.1 row (11)).
 *
 * **An unreadable parameter falls back rather than refusing** — `toAccessQuery`'s rule and reason: a stale or
 * hand-edited address should show the centre, not a 400 about its query string. So a read state outside the
 * vocabulary means both, a category nobody declared is dropped from the facet, and an ordering on anything but
 * `received` is the default. `ListQueryInterceptor` still refuses a direction that is neither `asc` nor `desc`,
 * which it can decide without knowing the route.
 *
 * **Several categories may be asked for at once** — one facet, several values, which the compact format already
 * expresses as `category,a,b`. The read state takes its first value only: two read states are both, which is no
 * facet at all.
 */
export const toNotificationCentreQuery = (input: {
  readonly list: ListQueryInput;
  readonly fallbackTake: number;
}): NotificationCentreQuery => {
  const valuesOf = (field: string) => input.list.filters.find((filter) => filter.field === field)?.values ?? [];

  const [readState] = valuesOf(NOTIFICATION_CENTRE_FILTER.READ_STATE);
  const categories = [...new Set(valuesOf(NOTIFICATION_CENTRE_FILTER.CATEGORY))].filter(
    (value): value is NotificationCategoryKey => isNotificationCategoryKey(value),
  );
  // One ordering at a time, for `toAccessQuery`'s reason.
  const [ordering] = input.list.order;
  const ordered = ordering !== undefined && ordering.field === NOTIFICATION_CENTRE_SORT.RECEIVED;

  return {
    readState: isNotificationReadState(readState) ? readState : null,
    categories,
    newestFirst: ordered ? ordering.direction === SORT_DIRECTION.DESC : true,
    skip: Math.max(0, input.list.skip),
    // The route is not bounded, so `onpage=-1` never arrives; the fallback covers the type and a route that lost
    // its interceptor, which then serves one page rather than everything.
    take: input.list.take ?? input.fallbackTake,
  };
};
