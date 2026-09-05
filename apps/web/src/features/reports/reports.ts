import type { IndexPage } from '@easyesg/ui';
import { REPORT_STATUS, type Report, type ReportStatus } from '@easyesg/contracts';

/**
 * S-06's read model — which reports are open to this member, and where each one stands
 * (UC-17, FR-25; task 32.2.2).
 *
 * **Pure, and carrying no `server-only`**, which is `periods.ts`'s and `entities.ts`'s split: the
 * filter, the sort and the page arithmetic are rules over data somebody else fetched, so every
 * branch is reachable from a unit test rather than only through a browser.
 *
 * **The status vocabulary is `@easyesg/contracts`' own**, never restated here. `REPORT_STATUS` is
 * held to the generated schema by a compile-time mirror in that package, so a fifth member added by
 * task 41.3 or 47 reaches this screen as a type error at the tone map below rather than as a row
 * that renders with no chip.
 */

/** The filter's "no filter" member. A real value, because the URL has to be able to say it. */
export const REPORT_FILTER_ANY = 'any';

export const REPORT_STATUS_FILTERS = [
  REPORT_FILTER_ANY,
  REPORT_STATUS.OPEN,
  REPORT_STATUS.LOCKED,
  REPORT_STATUS.READY_TO_FILE,
  REPORT_STATUS.FILED,
] as const;

export type ReportStatusFilter = (typeof REPORT_STATUS_FILTERS)[number];

export const REPORT_SORT = {
  YEAR: 'year',
  ENTITY: 'entity',
  /** The artboard's own default — "sorted by last activity". */
  ACTIVITY: 'activity',
  STATUS: 'status',
} as const;

export type ReportSort = (typeof REPORT_SORT)[keyof typeof REPORT_SORT];

export const REPORT_SORT_DIRECTION = { ASCENDING: 'asc', DESCENDING: 'desc' } as const;

export type ReportSortDirection =
  (typeof REPORT_SORT_DIRECTION)[keyof typeof REPORT_SORT_DIRECTION];

/**
 * One row of the list.
 *
 * The dates stay **strings in ISO form**, never `Date` — NFR-34 held at the last boundary that
 * could break it, exactly as `periods.ts` states it: `new Date('2026-12-31')` is an instant, and
 * rendered in a zone behind UTC it is the 30th, which is the wrong fiscal year. `updatedAt` is the
 * opposite case and is a number: it is an *instant* (OQ-50), and no legal question turns on it.
 */
export interface ReportRow {
  readonly id: string;
  readonly entityId: string;
  readonly entityName: string;
  readonly fiscalYear: number;
  readonly start: string;
  readonly end: string;
  readonly due: string | null;
  readonly status: ReportStatus;
  /** D-A's flag. Basic or Basic + Comprehensive; the reader is told which they are filing. */
  readonly scope: Report['scope'];
  /** DR-4's pin, shown rather than implied — only checkable by a reader if it is on screen. */
  readonly templateVersion: string;
  readonly taxonomyVersion: string;
  /** Epoch-ms. The artboard's *Last activity* column, minus the actor — see `toReportRows`. */
  readonly updatedAt: number;
}

export interface ReportView {
  readonly status: ReportStatusFilter;
  /** An entity id, or `any`. The list spans every entity the member can reach (UC-17). */
  readonly entity: string;
  /** A fiscal year, or `any`. Held as a string because that is what an address carries. */
  readonly year: string;
  readonly sort: ReportSort;
  readonly direction: ReportSortDirection;
  readonly page: number;
}

/**
 * **Newest activity first, and every filter defaults to *any*.**
 *
 * The order is the artboard's stated default and is how a reporter thinks — the filing being worked
 * on is the one touched last. The filter defaults are `periods.ts`'s reasoning exactly: §4.6
 * requires the filtered empty state to distinguish *nothing matches* from *nothing exists*, and any
 * non-`any` default would tell a member whose reports are all filed that they have none.
 */
export const DEFAULT_REPORT_VIEW: ReportView = {
  status: REPORT_FILTER_ANY,
  entity: REPORT_FILTER_ANY,
  year: REPORT_FILTER_ANY,
  sort: REPORT_SORT.ACTIVITY,
  direction: REPORT_SORT_DIRECTION.DESCENDING,
  page: 1,
};

/** An organization files once a year per entity, so a page is many years across many entities. The
 *  archetype carries pagination (§4.6); this size is what stops it being reached in practice. */
export const REPORT_PAGE_SIZE = 25;

export type ReportPage = IndexPage<ReportRow>;

const oneOf = <T extends string>(values: readonly T[], value: string | undefined): T | undefined =>
  values.find((candidate) => candidate === value);

/** The view held in the address (UX-4), so a filtered list can be linked and reloaded. */
export const readReportView = (
  params: Record<string, string | string[] | undefined>,
): ReportView => {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number.parseInt(single('page') ?? '', 10);

  return {
    status: oneOf(REPORT_STATUS_FILTERS, single('status')) ?? DEFAULT_REPORT_VIEW.status,
    // **Not validated against the known entities, deliberately.** An id from the address that
    // matches nothing filters to zero rows, which is §4.6's *nothing matches* state with its own
    // remedy — the honest answer for a stale link. Coercing it to `any` would silently show the
    // unfiltered list and tell the reader their filter had been applied.
    entity: single('entity') ?? DEFAULT_REPORT_VIEW.entity,
    year: single('year') ?? DEFAULT_REPORT_VIEW.year,
    sort: oneOf(Object.values(REPORT_SORT), single('sort')) ?? DEFAULT_REPORT_VIEW.sort,
    direction:
      oneOf(Object.values(REPORT_SORT_DIRECTION), single('dir')) ?? DEFAULT_REPORT_VIEW.direction,
    page: Number.isFinite(page) && page > 0 ? page : DEFAULT_REPORT_VIEW.page,
  };
};

/** The query string for a view, omitting whatever equals the default — so the bare path and the
 *  default view are one address rather than two spellings of it. */
export const reportViewQuery = (view: ReportView): string => {
  const params = new URLSearchParams();
  if (view.status !== DEFAULT_REPORT_VIEW.status) params.set('status', view.status);
  if (view.entity !== DEFAULT_REPORT_VIEW.entity) params.set('entity', view.entity);
  if (view.year !== DEFAULT_REPORT_VIEW.year) params.set('year', view.year);
  if (view.sort !== DEFAULT_REPORT_VIEW.sort) params.set('sort', view.sort);
  if (view.direction !== DEFAULT_REPORT_VIEW.direction) params.set('dir', view.direction);
  if (view.page !== DEFAULT_REPORT_VIEW.page) params.set('page', String(view.page));
  return params.toString();
};

/**
 * Work in hand first, whichever way the column is sorted.
 *
 * **Exhaustive by `Record`, not by a `switch` with a default**: task 41.3 and task 47 make
 * `ready_to_file` and `filed` reachable, and a default arm would give them a rank silently. This
 * fails to compile if the contract gains a member.
 */
const STATUS_RANK: Record<ReportStatus, number> = {
  [REPORT_STATUS.OPEN]: 0,
  [REPORT_STATUS.READY_TO_FILE]: 1,
  [REPORT_STATUS.LOCKED]: 2,
  [REPORT_STATUS.FILED]: 3,
};

const compareBy = (left: ReportRow, right: ReportRow, sort: ReportSort): number => {
  if (sort === REPORT_SORT.STATUS) return STATUS_RANK[left.status] - STATUS_RANK[right.status];
  if (sort === REPORT_SORT.ACTIVITY) return left.updatedAt - right.updatedAt;
  // `localeCompare` without a locale argument, which is the *sort* case and not a formatting one:
  // NFR-26's rule governs what a reader sees, and this decides row order. `Intl.Collator` would be
  // a formatter constructed at a call site, which `i18n/formats.ts` owns and lint forbids.
  if (sort === REPORT_SORT.ENTITY) return left.entityName.localeCompare(right.entityName);
  return left.fiscalYear - right.fiscalYear;
};

/**
 * **The artboard's *Last activity* column arrives half-built, and the half that is missing is
 * named rather than invented.** It draws "Today 14:32 · Ana R."; `GET /reports` answers `updatedAt`
 * and no actor, so the row carries the instant and nothing else. Who last touched a report is
 * **provenance — §6.13's chip and UX-68's per-field history** — and reaches a screen only when a
 * read answers it. (FR-55 is *retention* of attribution after access is removed, which is a
 * different claim and was the first draft's citation.) `architecture.md` §12.5.6 carries the
 * deferral and the fact that no task row owns the report-level actor.
 *
 * The three columns §5 lists that are refused outright are the parent row's own decision, with
 * their owners recorded: completion is task 41.3's roll-up and validation findings are task 40's.
 */
export const toReportRows = (reports: readonly Report[]): ReportRow[] =>
  reports.map((report) => ({
    id: report.id,
    entityId: report.subject.reportingEntityId,
    entityName: report.subject.entityName,
    fiscalYear: report.subject.fiscalYear,
    start: report.subject.periodStart.date,
    end: report.subject.periodEnd.date,
    due: report.subject.dueDate?.date ?? null,
    status: report.status,
    scope: report.scope,
    templateVersion: report.templateVersion,
    taxonomyVersion: report.taxonomyVersion,
    updatedAt: report.updatedAt,
  }));

/** The distinct entities and years present, for the filter selects — derived from the rows rather
 *  than fetched, so a filter can never offer a value that matches nothing. */
export const reportFilterOptions = (
  rows: readonly ReportRow[],
): {
  readonly entities: readonly { readonly id: string; readonly name: string }[];
  readonly years: readonly number[];
} => {
  const entities = new Map<string, string>();
  for (const row of rows) entities.set(row.entityId, row.entityName);

  return {
    entities: [...entities]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    years: [...new Set(rows.map((row) => row.fiscalYear))].sort((left, right) => right - left),
  };
};

export const applyReportView = (input: {
  readonly rows: readonly ReportRow[];
  readonly view: ReportView;
}): ReportPage => {
  const { rows, view } = input;

  const matched = rows.filter(
    (row) =>
      (view.status === REPORT_FILTER_ANY || row.status === view.status) &&
      (view.entity === REPORT_FILTER_ANY || row.entityId === view.entity) &&
      (view.year === REPORT_FILTER_ANY || String(row.fiscalYear) === view.year),
  );

  const sorted = [...matched].sort((left, right) => {
    const order = compareBy(left, right, view.sort);
    // A stable tiebreak, so two rows that compare equal never swap between renders. The id is the
    // only field guaranteed distinct — an entity can hold several years and a year several entities.
    const settled = order === 0 ? left.id.localeCompare(right.id) : order;
    return view.direction === REPORT_SORT_DIRECTION.DESCENDING ? -settled : settled;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / REPORT_PAGE_SIZE));
  const page = Math.min(view.page, pages);
  const from = (page - 1) * REPORT_PAGE_SIZE;

  // **`matched` and `total` are both reported, and that pair IS §4.6's two empty states** — the
  // shell distinguishes them itself. `periods.ts` carries the full reasoning.
  return {
    rows: sorted.slice(from, from + REPORT_PAGE_SIZE),
    matched: matched.length,
    total: rows.length,
    page,
    pageSize: REPORT_PAGE_SIZE,
  };
};
