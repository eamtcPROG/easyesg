import { SYSTEM_AUDIT_ACTION, type SystemAuditAction } from '@easyesg/contracts';

/**
 * A-08's addressable state (task 67.4; UX-4): the open record or the invitation form, and the log's
 * filters and page — every one of them in the URL, so a view is kept by keeping its address, which is
 * what §5.2's *filters held in the URL, no named saved views* means.
 *
 * **The log's dates are calendar days in the address** and instants only on the way to the api: which
 * instant *13 September* starts at is the reader's question, answered in the reader's own zone, and a
 * link shared across zones then means the same days to each reader rather than the sender's instants.
 */

/** Log entries per page — the register's size, for one density across the console's Index screens. */
export const LOG_PAGE_SIZE = 50;

/** The side panel's second use: the invitation form, where no row is selected. */
export const ACCOUNTS_PANEL = {
  INVITE: 'invite',
} as const;

export type AccountsPanel = (typeof ACCOUNTS_PANEL)[keyof typeof ACCOUNTS_PANEL];

export interface AccountsSearch {
  /** An account's or an invitation's id — the row whose record is open. */
  readonly selected?: string;
  readonly panel?: AccountsPanel;
  readonly operator?: string;
  readonly action?: SystemAuditAction;
  /** `YYYY-MM-DD`, inclusive. */
  readonly from?: string;
  /** `YYYY-MM-DD`, inclusive. */
  readonly to?: string;
  readonly page?: number;
}

export interface LogView {
  readonly operator: string | null;
  readonly action: SystemAuditAction | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly page: number;
}

export interface LogFilters {
  readonly operator: string | null;
  readonly action: SystemAuditAction | null;
  readonly from: string | null;
  readonly to: string | null;
}

const CALENDAR_DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const isSystemAuditAction = (value: unknown): value is SystemAuditAction =>
  typeof value === 'string' && (Object.values(SYSTEM_AUDIT_ACTION) as readonly string[]).includes(value);

const isAccountsPanel = (value: unknown): value is AccountsPanel =>
  typeof value === 'string' && (Object.values(ACCOUNTS_PANEL) as readonly string[]).includes(value);

const dayOf = (value: unknown): string | null =>
  typeof value === 'string' && CALENDAR_DAY.test(value) ? value : null;

/**
 * What the router hands `validateSearch`, narrowed. **A value this screen does not understand is
 * dropped**, so a stale or hand-edited address shows the unfiltered log rather than an error; and a
 * default is never written, so one view has one address.
 */
export const readAccountsSearch = (raw: Record<string, unknown>): AccountsSearch => {
  const page =
    typeof raw.page === 'number'
      ? raw.page
      : typeof raw.page === 'string'
        ? Number.parseInt(raw.page, 10)
        : Number.NaN;
  const from = dayOf(raw.from);
  const to = dayOf(raw.to);

  return {
    ...(typeof raw.selected === 'string' && raw.selected.length > 0 ? { selected: raw.selected } : {}),
    ...(isAccountsPanel(raw.panel) ? { panel: raw.panel } : {}),
    ...(typeof raw.operator === 'string' && UUID.test(raw.operator) ? { operator: raw.operator } : {}),
    ...(isSystemAuditAction(raw.action) ? { action: raw.action } : {}),
    ...(from === null ? {} : { from }),
    ...(to === null ? {} : { to }),
    ...(Number.isInteger(page) && page > 1 ? { page } : {}),
  };
};

export const logViewOf = (search: AccountsSearch): LogView => ({
  operator: search.operator ?? null,
  action: search.action ?? null,
  from: search.from ?? null,
  to: search.to ?? null,
  page: search.page ?? 1,
});

/** Whether any filter narrows the log — what tells its empty state *nothing matched* from *nothing yet*. */
export const logIsFiltered = (view: LogView): boolean =>
  view.operator !== null || view.action !== null || view.from !== null || view.to !== null;

/** The instant a calendar day begins in the reader's zone; `offset` moves by whole days, DST included. */
const startOfLocalDay = (day: string, offset = 0): number => {
  const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(year, month - 1, date + offset).getTime();
};

/**
 * The api's address for a view. **`to` becomes the start of the day after**, because the api's upper
 * bound is exclusive and the reader's *to 13 September* includes the whole of that day.
 */
export const logApiPath = (view: LogView): string => {
  const params = new URLSearchParams({ page: String(view.page), onpage: String(LOG_PAGE_SIZE) });
  if (view.operator !== null) params.set('operator', view.operator);
  if (view.action !== null) params.set('action', view.action);
  if (view.from !== null) params.set('from', String(startOfLocalDay(view.from)));
  if (view.to !== null) params.set('to', String(startOfLocalDay(view.to, 1)));
  return `/admin/audit-log?${params.toString()}`;
};

/** No filter at all — what *clear the filters* submits. */
export const NO_LOG_FILTERS: LogFilters = { operator: null, action: null, from: null, to: null };

/** What a filter select submits for *any*: a select has no empty option to choose. */
export const ANY_LOG_FILTER = 'any';

/**
 * The filters a submitted form carries, narrowed like the address is — so a form and a pasted link
 * cannot mean different things by the same values.
 */
export const logFiltersFromForm = (data: {
  readonly get: (name: string) => FormDataEntryValue | null;
}): LogFilters => {
  const text = (name: string): string | null => {
    const value = data.get(name);
    return typeof value === 'string' && value !== '' && value !== ANY_LOG_FILTER ? value : null;
  };
  const operator = text('operator');
  const action = text('action');

  return {
    operator: operator !== null && UUID.test(operator) ? operator : null,
    action: isSystemAuditAction(action) ? action : null,
    from: dayOf(text('from')),
    to: dayOf(text('to')),
  };
};

/** New filters start the log at its first page, and leave the account panel as it was. */
export const withLogFilters = (search: AccountsSearch, filters: LogFilters): AccountsSearch =>
  readAccountsSearch({ ...search, ...filters, page: undefined });

export const withLogPage = (search: AccountsSearch, page: number): AccountsSearch =>
  readAccountsSearch({ ...search, page });

/** Opening a record closes the invitation form: the panel holds one thing. */
export const withSelected = (search: AccountsSearch, selected: string | null): AccountsSearch =>
  readAccountsSearch({ ...search, selected: selected ?? undefined, panel: undefined });

export const withInvitePanel = (search: AccountsSearch, open: boolean): AccountsSearch =>
  readAccountsSearch({
    ...search,
    selected: undefined,
    panel: open ? ACCOUNTS_PANEL.INVITE : undefined,
  });
