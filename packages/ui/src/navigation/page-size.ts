/**
 * A paged list's page size — the three it offers, the one it starts on, and how an address's `onpage` is read. The
 * console's since task 170 (`design_spec.md` §5.2's preamble), and **every tenant list's since task 203.1** (UX-141:
 * *"25, 50 or 100 rows with 25 the default, every part of it in the URL (§5.2's rule, applied to the tenant lists
 * too)"*). Moved here from `apps/admin/src/lib/` the day the second application needed it (UX-89), beside the
 * `Pagination` that offers it, and **directive-free** so a Server Component reading an address can import it.
 *
 * **25 by default**: the api's own `DEFAULT_ON_PAGE`, and the Components sheet's pager specimen shows
 * a page of 20 — both well inside the admin ceiling of 200 (`MAX_ON_PAGE_ADMIN`). `onpage=-1`, the
 * api's "all rows", is never offered: the system audit log and the support-access log are append-only
 * and unbounded by construction, and serving all of either is a slow-motion outage. No tenant list offers it either.
 *
 * **In the URL like every other part of a view** (UX-4): each screen's search reads `onpage` through
 * `readPageSize` and never writes the default, so one view keeps one address.
 */
export const PAGE_SIZES = [25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 25;

const isPageSize = (value: number): value is PageSize => (PAGE_SIZES as readonly number[]).includes(value);

/**
 * An address's `onpage`, kept only when it is one of the offered sizes and not the default — an
 * unreadable or hand-edited value is dropped rather than refused, as every other key is.
 */
export const readPageSize = (raw: unknown): { readonly onpage?: PageSize } => {
  const value =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  return isPageSize(value) && value !== DEFAULT_PAGE_SIZE ? { onpage: value } : {};
};
