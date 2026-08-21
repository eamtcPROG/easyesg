/**
 * The list query builder.
 *
 * `apps/api` parses a compact format (§6.8, decided 18 Aug 2026):
 *
 *     ?filters=field,v1,v2|field2,v3&order=field,asc|other,desc&page=1&onpage=25
 *
 * It carries filtering and sorting in one parse, which is why it beats a bare `page`/`pageSize`
 * here. The accepted cost is stated in §6.8: OpenAPI can only describe a bespoke query encoding
 * as three strings, so the generated client in `@easyesg/contracts` types them loosely. This
 * module is the typed layer that puts the safety back, in one place rather than at each call
 * site — `buildListQuery` is the exact inverse of `ListQueryInterceptor.parseGroups` in
 * `apps/api`, and the separators below mirror `app/constants/pagination.constants.ts` the way
 * a wire value is always mirrored rather than imported (`web-not-to-api-src`).
 *
 * `onpage: ON_PAGE_ALL` ("all rows") is honoured only on routes explicitly marked bounded;
 * everything over an append-only store clamps to the API's ceiling instead — the clamp is the
 * server's, deliberately not re-implemented here.
 *
 * UX-4 makes this addressable state: filters belong in the URL, so a filtered index "is a link
 * a colleague can open at the same state". The URL→`ListQuery` parse arrives with the first
 * index screen (task 30), beside the screen that owns the URL.
 */

/** Pipe separates groups, comma separates values inside one group (pagination.constants.ts). */
const GROUP_SEPARATOR = '|';
const VALUE_SEPARATOR = ',';

/** Sentinel meaning "all rows"; the API rejects it on any route not marked bounded. */
export const ON_PAGE_ALL = -1;

export interface ListFilter {
  field: string;
  /** At least one value — the parser drops a group with fewer than two parts. */
  values: readonly (string | number)[];
}

export interface ListSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ListQuery {
  filters?: readonly ListFilter[];
  order?: readonly ListSort[];
  page?: number;
  onpage?: number;
}

/**
 * The compact grammar has no escaping — `ListQueryInterceptor` splits on the separators
 * unconditionally — so a field or value containing one would silently parse as extra groups.
 * Throwing here is a developer-facing error at build-the-request time, not user-facing text.
 */
function assertClean(part: string): string {
  if (part.includes(GROUP_SEPARATOR) || part.includes(VALUE_SEPARATOR)) {
    throw new Error(
      `List query values may not contain "${GROUP_SEPARATOR}" or "${VALUE_SEPARATOR}" ` +
        `(received "${part}") — the compact format has no escaping.`,
    );
  }
  return part;
}

const joinGroup = (parts: readonly (string | number)[]): string =>
  parts.map((part) => assertClean(String(part))).join(VALUE_SEPARATOR);

/**
 * Builds the query string (without a leading `?`); an empty query builds to `''`. Members are
 * emitted only when present, so a caller that wants the API's defaults sends nothing — the
 * defaults live server-side and are deliberately not duplicated here.
 */
export function buildListQuery(query: ListQuery = {}): string {
  const params = new URLSearchParams();

  if (query.filters?.length) {
    params.set(
      'filters',
      query.filters
        .map((filter) => joinGroup([filter.field, ...filter.values]))
        .join(GROUP_SEPARATOR),
    );
  }

  if (query.order?.length) {
    params.set(
      'order',
      query.order
        .map((sort) => joinGroup([sort.field, sort.direction]))
        .join(GROUP_SEPARATOR),
    );
  }

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.onpage !== undefined) params.set('onpage', String(query.onpage));

  return params.toString();
}
