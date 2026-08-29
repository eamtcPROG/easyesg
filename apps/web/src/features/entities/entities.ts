import type { IndexPage } from '@easyesg/ui';
import type { ReportingEntity } from '@easyesg/contracts';

/**
 * S-13's read model — the entities an organization reports on (FR-17 … FR-20, UC-52 … UC-55).
 *
 * **Pure, and carrying no `server-only`**, which is `features/organization/access.ts`'s split and
 * the same reason: the filter, the sort and the page arithmetic are rules over data somebody else
 * fetched, and importing the API client would make every branch but the happy one reachable only
 * through a browser.
 *
 * **The row is thinner than the artboard's, and each omission has an owner.** `EasyESG Organization
 * Admin.dc.html` draws six columns; four of them belong elsewhere and are refused rather than
 * invented — entity **IDNO** and its *verified* marker are FR-107's fiscal lookup on the billing
 * account, **employee count** is B1 disclosure data (UC-19) and not entity master data at all, the
 * **periods** column is task 31's, and the **entitlement counter** above the action is task 54.2's,
 * the same deferral S-16 recorded for seats. What is left is what FR-17 actually puts on an entity.
 */

/** What the status column says. The API's own vocabulary; a screen may not invent a third. */
export const ENTITY_STANDING = {
  ACTIVE: 'active',
  /** FR-20: out of active selection, its reports and exports intact. Read-only, never deleted. */
  ARCHIVED: 'archived',
} as const;

export type EntityStanding = (typeof ENTITY_STANDING)[keyof typeof ENTITY_STANDING];

/**
 * FR-19's reporting boundary — the axis B1 discloses and task 38's calculator aggregates over.
 *
 * The API's own vocabulary, mirrored here as the house `as const`. **There is no third member for
 * "not stated"**: null is the absence of an answer, and VSME asks the question explicitly, so a
 * `not_stated` value would make *"we have not decided"* look like a decision.
 */
export const CONSOLIDATION_BASIS = {
  INDIVIDUAL: 'individual',
  CONSOLIDATED: 'consolidated',
} as const;

export type ConsolidationBasis = (typeof CONSOLIDATION_BASIS)[keyof typeof CONSOLIDATION_BASIS];

/** The filter's "no filter" member. A real value, because the URL has to be able to say it. */
export const ENTITY_FILTER_ANY = 'any';

export const ENTITY_STANDING_FILTERS = [
  ENTITY_FILTER_ANY,
  ENTITY_STANDING.ACTIVE,
  ENTITY_STANDING.ARCHIVED,
] as const;

export type EntityStandingFilter = (typeof ENTITY_STANDING_FILTERS)[number];

export const ENTITY_SORT = {
  NAME: 'name',
  SITES: 'sites',
  STANDING: 'standing',
} as const;

export type EntitySort = (typeof ENTITY_SORT)[keyof typeof ENTITY_SORT];

export const ENTITY_SORT_DIRECTION = { ASCENDING: 'asc', DESCENDING: 'desc' } as const;

export type EntitySortDirection =
  (typeof ENTITY_SORT_DIRECTION)[keyof typeof ENTITY_SORT_DIRECTION];

/**
 * One row of the list.
 *
 * `activity` is the entity's codes **already resolved to words** — the Index renders them and
 * `GET /entities` answers bare keys, which on a screen is an internal identifier. The resolution
 * is one request for the whole page (`GET /entities/nace-codes?codes=`, task 30.4.2), and a code
 * the classifier no longer carries simply does not appear in the words while remaining in `codes`.
 */
export interface EntityRow {
  readonly id: string;
  readonly name: string;
  readonly legalForm: string | null;
  readonly codes: readonly string[];
  readonly activity: readonly string[];
  readonly siteCount: number;
  readonly consolidationBasis: string | null;
  readonly standing: EntityStanding;
}

export interface EntityView {
  readonly standing: EntityStandingFilter;
  readonly sort: EntitySort;
  readonly direction: EntitySortDirection;
  readonly page: number;
}

/**
 * **Active first, and the default filter is *any* rather than *active*.**
 *
 * §4.6 wants the filtered empty state to distinguish *nothing matches* from *nothing exists*, and a
 * default that hides archived entities would make "you have no entities" the first-use message for
 * an organization whose only entities are archived — the two states this screen must keep apart.
 * The sort puts active rows first instead, which achieves what hiding them was for.
 */
export const DEFAULT_ENTITY_VIEW: EntityView = {
  standing: ENTITY_FILTER_ANY,
  sort: ENTITY_SORT.STANDING,
  direction: ENTITY_SORT_DIRECTION.ASCENDING,
  page: 1,
};

/** Small by design: §4.6's Index carries pagination, and the artboard's own caption says the list
 *  "is short and will stay short". The page exists so the archetype is complete, not because a
 *  tenant will fill it. */
export const ENTITY_PAGE_SIZE = 25;

export type EntityPage = IndexPage<EntityRow>;

const oneOf = <T extends string>(values: readonly T[], value: string | undefined): T | undefined =>
  values.find((candidate) => candidate === value);

/**
 * The view held in the address (UX-4) — every addressable state is in the URL, so a filtered list
 * can be linked and reloaded.
 */
export const readEntityView = (
  params: Record<string, string | string[] | undefined>,
): EntityView => {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number.parseInt(single('page') ?? '', 10);

  return {
    standing: oneOf(ENTITY_STANDING_FILTERS, single('standing')) ?? DEFAULT_ENTITY_VIEW.standing,
    sort: oneOf(Object.values(ENTITY_SORT), single('sort')) ?? DEFAULT_ENTITY_VIEW.sort,
    direction:
      oneOf(Object.values(ENTITY_SORT_DIRECTION), single('dir')) ?? DEFAULT_ENTITY_VIEW.direction,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_ENTITY_VIEW.page,
  };
};

/** The query string for a view, omitting whatever equals the default — so a bare `/entities` and
 *  the default view are one address rather than two spellings of it. */
export const entityViewQuery = (view: EntityView): string => {
  const params = new URLSearchParams();
  if (view.standing !== DEFAULT_ENTITY_VIEW.standing) params.set('standing', view.standing);
  if (view.sort !== DEFAULT_ENTITY_VIEW.sort) params.set('sort', view.sort);
  if (view.direction !== DEFAULT_ENTITY_VIEW.direction) params.set('dir', view.direction);
  if (view.page !== DEFAULT_ENTITY_VIEW.page) params.set('page', String(view.page));
  return params.toString();
};

/** Active before archived, whichever way the column is sorted — see `DEFAULT_ENTITY_VIEW`. */
const STANDING_RANK: Record<EntityStanding, number> = {
  [ENTITY_STANDING.ACTIVE]: 0,
  [ENTITY_STANDING.ARCHIVED]: 1,
};

const compareBy = (left: EntityRow, right: EntityRow, sort: EntitySort): number => {
  if (sort === ENTITY_SORT.SITES) return left.siteCount - right.siteCount;
  if (sort === ENTITY_SORT.STANDING) {
    return STANDING_RANK[left.standing] - STANDING_RANK[right.standing];
  }
  return left.name.localeCompare(right.name);
};

/**
 * Turns the API's entities into the rows a page renders.
 *
 * The activity words are looked up by code rather than positionally: `resolve` drops a code the
 * classifier has retired, so the two lists are not the same length and zipping them would label
 * the wrong code.
 */
export const toEntityRows = (input: {
  readonly entities: readonly ReportingEntity[];
  readonly activity: ReadonlyMap<string, string>;
}): EntityRow[] =>
  input.entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    legalForm: entity.legalForm,
    codes: entity.naceCodes,
    activity: entity.naceCodes.flatMap((code: string) => {
      const label = input.activity.get(code);
      return label === undefined ? [] : [label];
    }),
    siteCount: entity.sites.length,
    consolidationBasis: entity.consolidationBasis,
    standing: entity.status === ENTITY_STANDING.ARCHIVED
      ? ENTITY_STANDING.ARCHIVED
      : ENTITY_STANDING.ACTIVE,
  }));

export const applyEntityView = (input: {
  readonly rows: readonly EntityRow[];
  readonly view: EntityView;
}): EntityPage => {
  const { rows, view } = input;

  const matched = rows.filter(
    (row) => view.standing === ENTITY_FILTER_ANY || row.standing === view.standing,
  );

  const ordered = matched.toSorted((left, right) => {
    const by = compareBy(left, right, view.sort);
    // Name is the tie-break everywhere, so the order is total and a re-render cannot reshuffle
    // equal rows under the reader's cursor.
    const settled = by !== 0 ? by : left.name.localeCompare(right.name);
    return view.direction === ENTITY_SORT_DIRECTION.ASCENDING ? settled : -settled;
  });

  const pageCount = Math.max(1, Math.ceil(ordered.length / ENTITY_PAGE_SIZE));
  const page = Math.min(Math.max(1, view.page), pageCount);
  const from = (page - 1) * ENTITY_PAGE_SIZE;

  // `matched` and `total` are the archetype's own way of telling its two empty states apart —
  // `total === 0` is first use and `matched === 0` with rows behind it is a filter that excluded
  // everything. Computing them here rather than a boolean is what lets `IndexShell` decide, which
  // is the point of the contract being shaped this way.
  return {
    rows: ordered.slice(from, from + ENTITY_PAGE_SIZE),
    matched: ordered.length,
    total: rows.length,
    page,
    pageSize: ENTITY_PAGE_SIZE,
  };
};
