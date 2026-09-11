import { SORT_DIRECTION } from '@api/app/dto/request-list.dto';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import {
  ACCESS_FILTER_ANY,
  ACCESS_FILTER_FIELD,
  ACCESS_SORT,
  isAccessSort,
  isAccessStanding,
  isMembershipRole,
  type AccessQuery,
} from '../models/access.model';

/**
 * §6.8's compact list query, narrowed to what S-16 can be asked (task 131).
 *
 * **Structural input rather than `RequestListDto`.** That class lives in `app/dto/` and carries
 * `@nestjs/swagger` decorators; `domain/` may not import a framework (`domain-free-of-frameworks`),
 * and this file is where the rules are, so the shape is declared locally and the DTO satisfies it by
 * construction. The consequence worth having is that every branch below is a unit spec with no Nest
 * container, no request and no database.
 *
 * **An unreadable parameter falls back rather than refusing.** A hand-edited or stale query string
 * should show the list, not a 400 about the query string — the same rule `readAccessView` applies in
 * the browser tier, and the reason the two can disagree without a reader noticing is exactly why the
 * fallbacks are written here as well. `ListQueryInterceptor` still refuses an unknown sort
 * *direction*, because that one it can decide without knowing the route.
 *
 * **A filter field this route does not understand is ignored, not an error.** The compact format is
 * shared across three projects and one screen's route has no standing to reject another's grammar;
 * what it must not do is let an unknown field silently become a filter.
 */
export interface ListQueryInput {
  readonly filters: readonly { readonly field: string; readonly values: readonly string[] }[];
  readonly order: readonly { readonly field: string; readonly direction: string }[];
  readonly skip: number;
  readonly take: number | undefined;
}

/** Recency first: an administrator opening this screen is looking at who is here now. */
export const DEFAULT_ACCESS_SORT = ACCESS_SORT.ACTIVITY;

export const DEFAULT_ACCESS_DESCENDING = true;

const firstValue = (input: ListQueryInput, field: string): string | undefined =>
  input.filters.find((filter) => filter.field === field)?.values[0];

export const toAccessQuery = (input: ListQueryInput, fallbackTake: number): AccessQuery => {
  const role = firstValue(input, ACCESS_FILTER_FIELD.ROLE);
  const standing = firstValue(input, ACCESS_FILTER_FIELD.STANDING);
  // Only the first ordering is honoured: this list has one order at a time by design (§4.6's
  // sortable column heads are single-select), and silently applying a second would make the
  // published grammar promise something the screen cannot express.
  const [ordering] = input.order;

  return {
    role: role !== undefined && isMembershipRole(role) ? role : ACCESS_FILTER_ANY,
    standing: standing !== undefined && isAccessStanding(standing) ? standing : ACCESS_FILTER_ANY,
    sort: ordering !== undefined && isAccessSort(ordering.field) ? ordering.field : DEFAULT_ACCESS_SORT,
    descending:
      ordering !== undefined && isAccessSort(ordering.field)
        ? ordering.direction === SORT_DIRECTION.DESC
        : DEFAULT_ACCESS_DESCENDING,
    skip: Math.max(0, input.skip),
    // **Not the `onpage=-1` path** — this route is not bounded, so `ListQueryInterceptor` answers
    // 400 before the handler runs and `undefined` never arrives from a request. The fallback covers
    // the type (`RequestListDto.take` is `number | undefined`) and the controller's own
    // `?? new RequestListDto()` guard, so a route that lost its interceptor serves one page rather
    // than everything.
    take: input.take ?? fallbackTake,
  };
};

/** Exported for the spec and for the repository's `ORDER BY`, which maps this to SQL it owns. */
export const ROLE_RANK = {
  [MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR]: 0,
  [MEMBERSHIP_ROLE.EDITOR]: 1,
  [MEMBERSHIP_ROLE.VIEWER]: 2,
} as const;
