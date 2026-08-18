/**
 * List-query bounds.
 *
 * Wire format (inherited from the sibling projects, so one shape spans all three):
 *   ?filters=field,v1,v2|field2,v3 & order=field,asc|other,desc & page=1 & onpage=25
 *
 * Pipe separates groups, comma separates values inside one group.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_ON_PAGE = 25;

/**
 * Hard ceiling for a single page.
 *
 * `onpage=-1` ("all rows") is honoured ONLY on routes explicitly marked bounded.
 * Everything backed by an append-only store — audit.system_audit_log, the billing
 * ledger, metering events — is unbounded by construction and retains for six years
 * (architecture.md §12.5.7, DR-6). Serving "all rows" there is a slow-motion outage,
 * so those routes clamp to this value instead.
 */
export const MAX_ON_PAGE = 100;
export const MAX_ON_PAGE_ADMIN = 200;

/** Sentinel meaning "all rows". Rejected on any route not marked bounded. */
export const ON_PAGE_ALL = -1;

export const LIST_GROUP_SEPARATOR = '|';
export const LIST_VALUE_SEPARATOR = ',';
