import { SORT_DIRECTION, type SortDirection } from '@easyesg/ui';

/**
 * A-02's addressable state (task 67.3; UX-4) — what the register's URL holds, what it means when a
 * key is absent, and the API address it asks for.
 *
 * **Every key is optional, and an unreadable one is dropped rather than refused.** A bare
 * `/organizations` is the default view — every Platform Administrator's console home — and a stale or
 * hand-edited address should show the register rather than a screen about its query string. The
 * API falls back the same way (`organization-register-query.ts`), so the two tiers agree on what an
 * unreadable value means rather than each deciding.
 *
 * **Pure, and in `tools/` with its spec** (`pure-logic-leaves-the-component`): the route reads it as
 * `validateSearch`, the board's transitions write through it, and none of that needs a DOM to test.
 */
export const REGISTER_SORT = {
  NAME: 'name',
  REGISTERED: 'registered',
  ENTITIES: 'entities',
  REPORTS: 'reports',
  ACTIVITY: 'activity',
} as const;

export type RegisterSort = (typeof REGISTER_SORT)[keyof typeof REGISTER_SORT];

/** Every column the table draws: the orderings, and IDNO, which is searched but not ordered by. */
export const REGISTER_COLUMN = { ...REGISTER_SORT, IDNO: 'idno' } as const;

export type RegisterColumn = (typeof REGISTER_COLUMN)[keyof typeof REGISTER_COLUMN];

/** Rows per page — the compact console's denser page (§12.1), inside the api's admin ceiling of 200. */
export const REGISTER_PAGE_SIZE = 50;

export interface RegisterSearch {
  readonly q?: string;
  readonly sort?: RegisterSort;
  readonly direction?: SortDirection;
  readonly page?: number;
  /** The organization whose record panel is open — addressable like every other part of the view. */
  readonly selected?: string;
}

/** The view a search resolves to, every default applied. */
export interface RegisterView {
  readonly search: string;
  readonly sort: RegisterSort;
  readonly direction: SortDirection;
  readonly page: number;
  readonly selected: string | null;
}

export const isRegisterSort = (value: unknown): value is RegisterSort =>
  typeof value === 'string' && (Object.values(REGISTER_SORT) as readonly string[]).includes(value);

const isSortDirection = (value: unknown): value is SortDirection =>
  typeof value === 'string' && (Object.values(SORT_DIRECTION) as readonly string[]).includes(value);

/** `validateSearch`: keeps what it can read, drops the rest, and never keeps a default's value. */
export const readRegisterSearch = (raw: Record<string, unknown>): RegisterSearch => {
  const page =
    typeof raw.page === 'number'
      ? raw.page
      : typeof raw.page === 'string'
        ? Number.parseInt(raw.page, 10)
        : Number.NaN;
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';

  return {
    ...(q.length > 0 ? { q } : {}),
    ...(isRegisterSort(raw.sort) ? { sort: raw.sort } : {}),
    ...(isSortDirection(raw.direction) ? { direction: raw.direction } : {}),
    // Page 1 is the default, so it is not written: one view, one address.
    ...(Number.isInteger(page) && page > 1 ? { page } : {}),
    ...(typeof raw.selected === 'string' && raw.selected.length > 0 ? { selected: raw.selected } : {}),
  };
};

export const registerViewOf = (search: RegisterSearch): RegisterView => ({
  search: search.q ?? '',
  sort: search.sort ?? REGISTER_SORT.NAME,
  direction: search.direction ?? SORT_DIRECTION.ASCENDING,
  page: search.page ?? 1,
  selected: search.selected ?? null,
});

/**
 * The api's address for a view: the compact grammar's `order`, `page` and `onpage`, and `search` as
 * its own parameter — an organization's name may contain the grammar's separators (§12.5.6).
 */
export const registerApiPath = (view: Omit<RegisterView, 'selected'>): string => {
  const params = new URLSearchParams({
    order: `${view.sort},${view.direction}`,
    page: String(view.page),
    onpage: String(REGISTER_PAGE_SIZE),
  });
  if (view.search.length > 0) params.set('search', view.search);
  return `/admin/organizations?${params.toString()}`;
};

/** A new search starts from the first page and closes the record, which the results may not hold. */
export const withSearch = (search: RegisterSearch, q: string): RegisterSearch =>
  readRegisterSearch({ ...search, q, page: undefined, selected: undefined });

/** A new order starts from the first page; the open record stays open, since it is still in the set. */
export const withSort = (
  search: RegisterSearch,
  sort: { readonly column: RegisterSort; readonly direction: SortDirection },
): RegisterSearch =>
  readRegisterSearch({ ...search, sort: sort.column, direction: sort.direction, page: undefined });

export const withPage = (search: RegisterSearch, page: number): RegisterSearch =>
  readRegisterSearch({ ...search, page, selected: undefined });

export const withSelected = (search: RegisterSearch, selected: string | null): RegisterSearch =>
  readRegisterSearch({ ...search, selected: selected ?? undefined });
