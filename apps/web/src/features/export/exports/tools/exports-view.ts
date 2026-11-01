import { EXPORT_FORMAT, EXPORT_STATUS, type ExportFormat } from '@easyesg/contracts';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { DEFAULT_PAGE_SIZE, toPageSize, type PageSize } from '@easyesg/ui';
import { SORT_DIRECTION, type ListQuery, type SortDirection } from '@/lib/pagination';

/**
 * S-11's history as an address (task 47.3; UX-4, UX-49) — what the Index shows, read from the URL and never trusted,
 * written back to it, and asked of the api as §6.8's compact list query.
 *
 * **Two facets, format and language** (`architecture.md` §12.5.6's task-47 row (m)): every export of a report is at the
 * report's own pin until a migration exists, so a taxonomy facet over one report's history could only offer one value.
 * **One ordering**, when it was asked for — newest first unless the reader turns it.
 */

/** The facets' *no filter* value — a value rather than `''`, which the select reserves (`ACCESS_FILTER_ANY`'s reason). */
export const EXPORTS_FILTER_ANY = 'any';

/** The history's columns; the one it orders by is when an export was asked for. */
export const EXPORTS_COLUMN = {
  REQUESTED: 'requested',
  FILE: 'file',
  VERSIONS: 'versions',
  STATUS: 'status',
  ACTION: 'action',
} as const;

export type ExportsColumnKey = (typeof EXPORTS_COLUMN)[keyof typeof EXPORTS_COLUMN];

/** The api's names for what this screen filters and orders by — `EXPORT_HISTORY_FILTER` and `EXPORT_HISTORY_SORT`. */
const LIST_FIELD = { FORMAT: 'format', LANGUAGE: 'language', STATUS: 'status', REQUESTED: 'requested' } as const;

/** The address's own parameter names — one spelling for the reader and the writer. */
const PARAM = { FORMAT: 'format', LANGUAGE: 'language', DIRECTION: 'dir', PAGE: 'page', PAGE_SIZE: 'onpage' } as const;

export interface ExportsView {
  readonly format: ExportFormat | typeof EXPORTS_FILTER_ANY;
  readonly language: Locale | typeof EXPORTS_FILTER_ANY;
  readonly direction: SortDirection;
  readonly page: number;
  /** UX-141's rows per page — 25, 50 or 100. */
  readonly pageSize: PageSize;
}

/** Newest first: the reader opening the history is most often looking for what was just sent. */
export const DEFAULT_EXPORTS_VIEW: ExportsView = {
  format: EXPORTS_FILTER_ANY,
  language: EXPORTS_FILTER_ANY,
  direction: SORT_DIRECTION.DESC,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const oneOf = <T extends string>(values: readonly T[], candidate: string | undefined): T | null =>
  candidate !== undefined && (values as readonly string[]).includes(candidate) ? (candidate as T) : null;

/** The view the address names — an unreadable parameter falls back to its default rather than to a screen about it. */
export const readExportsView = (params: Readonly<Record<string, string | string[] | undefined>>): ExportsView => {
  const single = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const page = Number.parseInt(single(PARAM.PAGE) ?? '', 10);
  return {
    format: oneOf(Object.values(EXPORT_FORMAT), single(PARAM.FORMAT)) ?? DEFAULT_EXPORTS_VIEW.format,
    language: oneOf(LOCALES, single(PARAM.LANGUAGE)) ?? DEFAULT_EXPORTS_VIEW.language,
    direction: oneOf(Object.values(SORT_DIRECTION), single(PARAM.DIRECTION)) ?? DEFAULT_EXPORTS_VIEW.direction,
    page: Number.isSafeInteger(page) && page > 0 ? page : DEFAULT_EXPORTS_VIEW.page,
    pageSize: toPageSize(single(PARAM.PAGE_SIZE)),
  };
};

/** The query string for a view, leaving out whatever is the default, so the bare address and the default view agree. */
export const exportsViewQuery = (view: ExportsView): string => {
  const params = new URLSearchParams();
  if (view.format !== DEFAULT_EXPORTS_VIEW.format) params.set(PARAM.FORMAT, view.format);
  if (view.language !== DEFAULT_EXPORTS_VIEW.language) params.set(PARAM.LANGUAGE, view.language);
  if (view.direction !== DEFAULT_EXPORTS_VIEW.direction) params.set(PARAM.DIRECTION, view.direction);
  if (view.page !== DEFAULT_EXPORTS_VIEW.page) params.set(PARAM.PAGE, String(view.page));
  if (view.pageSize !== DEFAULT_EXPORTS_VIEW.pageSize) params.set(PARAM.PAGE_SIZE, String(view.pageSize));
  return params.toString();
};

/** The view as the api's list query — a facet left at *any* is omitted, so the sentinel never reaches the wire. */
export const exportsListQuery = (view: ExportsView): ListQuery => ({
  filters: [
    ...(view.format === EXPORTS_FILTER_ANY ? [] : [{ field: LIST_FIELD.FORMAT, values: [view.format] }]),
    ...(view.language === EXPORTS_FILTER_ANY ? [] : [{ field: LIST_FIELD.LANGUAGE, values: [view.language] }]),
  ],
  order: [{ field: LIST_FIELD.REQUESTED, direction: view.direction }],
  page: view.page,
  onpage: view.pageSize,
});

/**
 * Whether the report has a completed export, asked of the whole history rather than of a page of it (§12.5.6's
 * task-47 row (n)): one row of it, filtered by status, whose total answers. The mark is offered when it is not zero.
 */
export const COMPLETED_EXPORTS_QUERY: ListQuery = {
  filters: [{ field: LIST_FIELD.STATUS, values: [EXPORT_STATUS.COMPLETED] }],
  onpage: 1,
};
