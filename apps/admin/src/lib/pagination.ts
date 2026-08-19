/**
 * List-query helpers for the compact wire format.
 *
 * NOT BUILT — a docblock over an empty export.
 *
 * The format is fixed by apps/api's `ListQueryInterceptor`:
 *   ?filters=field,v1,v2|field2,v3 & order=field,asc & page=1 & onpage=25
 * Pipe separates groups, comma separates values within one group.
 *
 * Admin's ceiling is `MAX_ON_PAGE_ADMIN` = 200, double the tenant 100. `onpage=-1` means "all
 * rows" and is honoured only on routes explicitly marked bounded — never on the system audit log,
 * the billing ledger or metering events, which are append-only, unbounded by construction and
 * retained for six years (DR-6, §12.5.7). Serving "all rows" there is a slow-motion outage.
 *
 * These values are the API's, not this app's. They live in
 * `apps/api/src/app/constants/pagination.constants.ts` and must arrive through
 * `@easyesg/contracts` — `admin-not-to-api-src` fails the build on a direct import.
 *
 * TanStack Router's typed search params are the mechanism that makes UX-4 hold: every addressable
 * state, "an admin queue filter" named explicitly among them, must be bookmarkable and restore the
 * same state on load. A filter kept in component state instead of the URL is a UX-4 defect.
 */
export {};
