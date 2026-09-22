import { SORT_DIRECTION, type ListQueryInput } from '@api/contracts/types/list-query';
import {
  ORGANIZATION_REGISTER_SORT,
  isOrganizationRegisterSort,
  type OrganizationRegisterQuery,
} from '../models/organization-register.model';

/**
 * §6.8's compact list query plus the register's own `search`, narrowed to what A-02 can be asked
 * (task 67.3) — `identity/access`'s `toAccessQuery` for S-16, and the same two rules for its reasons.
 *
 * **An unreadable parameter falls back rather than refusing.** A hand-edited or stale address should
 * show the register, not a 400 about its query string — and the console holds every one of these in
 * its URL (UX-4), which is exactly where stale ones come from.
 *
 * **Search is its own parameter, not a compact facet** (§12.5.6's task-67.3 row): an organization's
 * name may contain the grammar's `,` and `|`, which would split a search into facets nobody typed.
 * It is trimmed, cut to a length no name reaches, and `null` when nothing is left.
 */
/** The compact query without its facets: A-02 has none, and its search is a parameter of its own. */
export type RegisterListInput = Omit<ListQueryInput, 'filters'>;

/** By name: a support request names an organization, and triage starts by finding it. */
export const DEFAULT_REGISTER_SORT = ORGANIZATION_REGISTER_SORT.NAME;

/** Longer than any registered name or IDNO; a search past it is cut rather than refused. */
export const REGISTER_SEARCH_MAX_LENGTH = 100;

export const toOrganizationRegisterQuery = (input: {
  readonly list: RegisterListInput;
  /** As received — the query string can repeat a parameter, which arrives as an array. */
  readonly search: unknown;
  readonly fallbackTake: number;
}): OrganizationRegisterQuery => {
  // Only the first ordering is honoured, for `toAccessQuery`'s reason: one order at a time.
  const [ordering] = input.list.order;
  const sort =
    ordering !== undefined && isOrganizationRegisterSort(ordering.field)
      ? { sort: ordering.field, descending: ordering.direction === SORT_DIRECTION.DESC }
      : { sort: DEFAULT_REGISTER_SORT, descending: false };

  const typed =
    typeof input.search === 'string'
      ? input.search.trim().slice(0, REGISTER_SEARCH_MAX_LENGTH).trim()
      : '';

  return {
    search: typed === '' ? null : typed,
    ...sort,
    skip: Math.max(0, input.list.skip),
    // The interceptor always supplies a page size on this route, which is not bounded; the fallback
    // covers the type and a route that lost its interceptor, which then serves one page, not all.
    take: input.list.take ?? input.fallbackTake,
  };
};
