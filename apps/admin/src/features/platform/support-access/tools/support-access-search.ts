/**
 * A-07's addressable state (task 67.9; UX-4): the organization a request is being written for, the grant being
 * read with the report and module open under it, the log's open entry, and the log's page — each in the URL, so
 * a link pasted into a support ticket reopens what the operator was looking at.
 *
 * **Opening one thing closes what it replaces**: a request form and a grant's reports are one panel, and a module
 * belongs to the report it was opened from. The `with…` functions below are where that is decided, once.
 */

/** Log entries per page — the register's size, for one density across the console's Index screens. */
export const SUPPORT_ACCESS_PAGE_SIZE = 50;

export interface SupportAccessSearch {
  /** The organization the request form is for — A-02's exit. */
  readonly organization?: string;
  /** The running grant whose reports are open. */
  readonly request?: string;
  /** The report open under that grant. */
  readonly report?: string;
  /** The module open in that report. */
  readonly module?: string;
  /** The log entry whose record is open. */
  readonly entry?: string;
  readonly page?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** A module is a letter and a number — `B3`, `C9` — which is the whole of what this screen may put in a path. */
const MODULE = /^[A-Z]\d{1,2}$/u;

const uuidOf = (value: unknown): string | null => (typeof value === 'string' && UUID.test(value) ? value : null);

const pageOf = (value: unknown): number | null => {
  const page = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isInteger(page) && page > 1 ? page : null;
};

/**
 * What the router hands `validateSearch`, narrowed. **A value this screen does not understand is dropped**, and so
 * is anything whose parent is missing — a module without its report, a report without its grant — so a hand-edited
 * address opens the nearest view that makes sense rather than a read that cannot. A default is never written.
 */
export const readSupportAccessSearch = (raw: Record<string, unknown>): SupportAccessSearch => {
  const request = uuidOf(raw.request);
  const report = request === null ? null : uuidOf(raw.report);
  const module = report !== null && typeof raw.module === 'string' && MODULE.test(raw.module) ? raw.module : null;
  // One panel: a grant being read wins over a request form, since the form can be reopened from A-02.
  const organization = request === null ? uuidOf(raw.organization) : null;
  const entry = uuidOf(raw.entry);
  const page = pageOf(raw.page);

  return {
    ...(organization === null ? {} : { organization }),
    ...(request === null ? {} : { request }),
    ...(report === null ? {} : { report }),
    ...(module === null ? {} : { module }),
    ...(entry === null ? {} : { entry }),
    ...(page === null ? {} : { page }),
  };
};

/** The request form closed — after it was sent, or abandoned. */
export const withoutRequestForm = (search: SupportAccessSearch): SupportAccessSearch =>
  readSupportAccessSearch({ ...search, organization: undefined });

/** A grant's reports opened, or closed with `null`; either way nothing under the previous grant stays open. */
export const withGrant = (search: SupportAccessSearch, requestId: string | null): SupportAccessSearch =>
  readSupportAccessSearch({
    ...search,
    organization: undefined,
    request: requestId ?? undefined,
    report: undefined,
    module: undefined,
  });

export const withReport = (search: SupportAccessSearch, reportId: string | null): SupportAccessSearch =>
  readSupportAccessSearch({ ...search, report: reportId ?? undefined, module: undefined });

export const withModule = (search: SupportAccessSearch, module: string | null): SupportAccessSearch =>
  readSupportAccessSearch({ ...search, module: module ?? undefined });

export const withEntry = (search: SupportAccessSearch, entryId: string | null): SupportAccessSearch =>
  readSupportAccessSearch({ ...search, entry: entryId ?? undefined });

export const withLogPage = (search: SupportAccessSearch, page: number): SupportAccessSearch =>
  readSupportAccessSearch({ ...search, page });

/** The api's address for one page of the log. */
export const logApiPath = (page: number): string =>
  `/admin/support-access?${new URLSearchParams({ page: String(page), onpage: String(SUPPORT_ACCESS_PAGE_SIZE) }).toString()}`;

/** A grant, as the api names it in every path under it. */
export interface GrantScope {
  readonly organizationId: string;
  readonly requestId: string;
}

/** The api's address for a read under a grant: the reports, a report's modules, or one module. */
export const grantApiPath = (input: GrantScope & { readonly reportId?: string; readonly module?: string }): string => {
  const base = `/admin/organizations/${encodeURIComponent(input.organizationId)}/support-access/${encodeURIComponent(input.requestId)}`;
  if (input.reportId === undefined) return `${base}/reports`;
  const report = `${base}/reports/${encodeURIComponent(input.reportId)}/modules`;
  return input.module === undefined ? report : `${report}/${encodeURIComponent(input.module)}`;
};
