import type { IndexPage } from '@easyesg/ui';
import type { ReportingPeriod } from '@easyesg/contracts';

/**
 * S-14's read model — the reporting periods an entity files against (FR-21, FR-22, FR-45, FR-66;
 * UC-56 … UC-58).
 *
 * **Pure, and carrying no `server-only`**, which is `entities.ts`'s split: the filter, the sort and
 * the page arithmetic are rules over data somebody else fetched, so every branch is reachable from
 * a unit test rather than only through a browser.
 */

/**
 * What the standing column says. **Derived from `lockedAt`, not a field**: FR-22 makes the lock a
 * property of the period and the API answers a timestamp, so a third value here would be a state
 * the server cannot produce.
 */
export const PERIOD_STANDING = {
  /** Editable, and the only state in which a report inside it can be authored (FR-26). */
  OPEN: 'open',
  /** Read-only for everyone, the administrator included. Reopening is the only route through. */
  LOCKED: 'locked',
} as const;

export type PeriodStanding = (typeof PERIOD_STANDING)[keyof typeof PERIOD_STANDING];

/** The filter's "no filter" member. A real value, because the URL has to be able to say it. */
export const PERIOD_FILTER_ANY = 'any';

export const PERIOD_STANDING_FILTERS = [
  PERIOD_FILTER_ANY,
  PERIOD_STANDING.OPEN,
  PERIOD_STANDING.LOCKED,
] as const;

export type PeriodStandingFilter = (typeof PERIOD_STANDING_FILTERS)[number];

export const PERIOD_SORT = {
  YEAR: 'year',
  DUE: 'due',
  STANDING: 'standing',
} as const;

export type PeriodSort = (typeof PERIOD_SORT)[keyof typeof PERIOD_SORT];

export const PERIOD_SORT_DIRECTION = { ASCENDING: 'asc', DESCENDING: 'desc' } as const;

export type PeriodSortDirection =
  (typeof PERIOD_SORT_DIRECTION)[keyof typeof PERIOD_SORT_DIRECTION];

/**
 * One row of the list.
 *
 * The dates stay **strings in ISO form**, never `Date`. That is NFR-34 held at the last boundary
 * that could break it: `new Date('2026-12-31')` is an instant, and rendered in a zone behind UTC it
 * is the 30th — the wrong fiscal year, and FR-125 makes a filing against the wrong year
 * uncorrectable by editing. The repository already selects `::text` for exactly this reason on the
 * way out of Postgres; this is the same refusal on the way into a component.
 */
export interface PeriodRow {
  readonly id: string;
  readonly fiscalYear: number;
  readonly start: string;
  readonly end: string;
  readonly due: string | null;
  readonly standing: PeriodStanding;
  /** DR-4's pin, shown rather than implied — it is only checkable by a reader if it is on screen. */
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  /** FR-45's linkage. Null for an entity's first period, which is a fact worth showing. */
  readonly hasPrior: boolean;
}

export interface PeriodView {
  readonly standing: PeriodStandingFilter;
  readonly sort: PeriodSort;
  readonly direction: PeriodSortDirection;
  readonly page: number;
}

/**
 * **Newest year first, and the default filter is *any* rather than *open*.**
 *
 * The year order is how the API answers and how a reporter thinks — this year's filing is the one
 * being worked on. The filter default is `entities.ts`'s reasoning exactly: §4.6 requires the
 * filtered empty state to distinguish *nothing matches* from *nothing exists*, and defaulting to
 * *open* would tell an entity whose every period is locked that it has no periods at all.
 */
export const DEFAULT_PERIOD_VIEW: PeriodView = {
  standing: PERIOD_FILTER_ANY,
  sort: PERIOD_SORT.YEAR,
  direction: PERIOD_SORT_DIRECTION.DESCENDING,
  page: 1,
};

/** An entity files once a year, so a page is a decade and a half. The archetype carries pagination
 *  (§4.6); this size is what stops it ever being reached in practice. */
export const PERIOD_PAGE_SIZE = 25;

export type PeriodPage = IndexPage<PeriodRow>;

const oneOf = <T extends string>(values: readonly T[], value: string | undefined): T | undefined =>
  values.find((candidate) => candidate === value);

/** The view held in the address (UX-4), so a filtered list can be linked and reloaded. */
export const readPeriodView = (
  params: Record<string, string | string[] | undefined>,
): PeriodView => {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number.parseInt(single('page') ?? '', 10);

  return {
    standing: oneOf(PERIOD_STANDING_FILTERS, single('standing')) ?? DEFAULT_PERIOD_VIEW.standing,
    sort: oneOf(Object.values(PERIOD_SORT), single('sort')) ?? DEFAULT_PERIOD_VIEW.sort,
    direction:
      oneOf(Object.values(PERIOD_SORT_DIRECTION), single('dir')) ?? DEFAULT_PERIOD_VIEW.direction,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_PERIOD_VIEW.page,
  };
};

/** The query string for a view, omitting whatever equals the default — so the bare path and the
 *  default view are one address rather than two spellings of it. */
export const periodViewQuery = (view: PeriodView): string => {
  const params = new URLSearchParams();
  if (view.standing !== DEFAULT_PERIOD_VIEW.standing) params.set('standing', view.standing);
  if (view.sort !== DEFAULT_PERIOD_VIEW.sort) params.set('sort', view.sort);
  if (view.direction !== DEFAULT_PERIOD_VIEW.direction) params.set('dir', view.direction);
  if (view.page !== DEFAULT_PERIOD_VIEW.page) params.set('page', String(view.page));
  return params.toString();
};

/** Open before locked, whichever way the column is sorted — the work in hand sorts to the top. */
const STANDING_RANK: Record<PeriodStanding, number> = {
  [PERIOD_STANDING.OPEN]: 0,
  [PERIOD_STANDING.LOCKED]: 1,
};

const compareBy = (left: PeriodRow, right: PeriodRow, sort: PeriodSort): number => {
  if (sort === PERIOD_SORT.STANDING) {
    return STANDING_RANK[left.standing] - STANDING_RANK[right.standing];
  }
  if (sort === PERIOD_SORT.DUE) {
    // A period with no due date sorts last whichever way the column runs — FR-21 makes it optional,
    // and an absent deadline is not an early one. Comparing `''` would put them first ascending.
    if (left.due === null && right.due === null) return 0;
    if (left.due === null) return 1;
    if (right.due === null) return -1;
    return left.due.localeCompare(right.due);
  }
  return left.fiscalYear - right.fiscalYear;
};

export const toPeriodRows = (periods: readonly ReportingPeriod[]): PeriodRow[] =>
  periods.map((period) => ({
    id: period.id,
    fiscalYear: period.fiscalYear,
    start: period.periodStart.date,
    end: period.periodEnd.date,
    due: period.dueDate?.date ?? null,
    standing: period.lockedAt === null ? PERIOD_STANDING.OPEN : PERIOD_STANDING.LOCKED,
    templateVersion: period.templateVersion,
    taxonomyVersion: period.taxonomyVersion,
    hasPrior: period.priorPeriodId !== null,
  }));

export const applyPeriodView = (input: {
  readonly rows: readonly PeriodRow[];
  readonly view: PeriodView;
}): PeriodPage => {
  const { rows, view } = input;

  const matched = rows.filter(
    (row) => view.standing === PERIOD_FILTER_ANY || row.standing === view.standing,
  );

  const sorted = [...matched].sort((left, right) => {
    const order = compareBy(left, right, view.sort);
    // A stable tiebreak, so two periods of the same year never swap between renders.
    const settled = order === 0 ? left.start.localeCompare(right.start) : order;
    return view.direction === PERIOD_SORT_DIRECTION.DESCENDING ? -settled : settled;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PERIOD_PAGE_SIZE));
  const page = Math.min(view.page, pages);
  const from = (page - 1) * PERIOD_PAGE_SIZE;

  // **`matched` and `total` are both reported, and that pair IS §4.6's two empty states.** The
  // shell distinguishes them itself: `total === 0` is *nothing exists* and teaches, while
  // `matched === 0` with a non-zero total is *nothing matches* and offers to clear the filter. A
  // page that collapsed them into one count would make the shell unable to tell them apart, which
  // is the distinction the archetype exists to draw.
  return {
    rows: sorted.slice(from, from + PERIOD_PAGE_SIZE),
    matched: matched.length,
    total: rows.length,
    page,
    pageSize: PERIOD_PAGE_SIZE,
  };
};
