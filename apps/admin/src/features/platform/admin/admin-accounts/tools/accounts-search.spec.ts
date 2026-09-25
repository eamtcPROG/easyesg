import { describe, expect, it } from 'vitest';
import {
  logApiPath,
  logFiltersFromForm,
  logIsFiltered,
  logViewOf,
  readAccountsSearch,
  withInvitePanel,
  withLogFilters,
  withLogPage,
  withLogPageSize,
  withSelected,
} from './accounts-search';

const OPERATOR = '01920000-0000-7000-8000-00000000000a';

describe('A-08’s address (task 67.4, UX-4)', () => {
  it('keeps what it understands and drops the rest, writing no default', () => {
    expect(
      readAccountsSearch({
        selected: 'row-1',
        panel: 'invite',
        operator: OPERATOR,
        action: 'admin.account.suspended',
        from: '2026-09-01',
        to: '2026-09-13',
        page: '3',
        onpage: '100',
      }),
    ).toEqual({
      selected: 'row-1',
      panel: 'invite',
      operator: OPERATOR,
      action: 'admin.account.suspended',
      from: '2026-09-01',
      to: '2026-09-13',
      page: 3,
      onpage: 100,
    });

    expect(
      readAccountsSearch({
        panel: 'settings',
        operator: 'someone',
        action: 'admin.account.deleted',
        from: '13.09.2026',
        to: '2026-13-01',
        page: '1',
        onpage: '-1',
      }),
    ).toEqual({});
    // The default size is not written either, and a size the pager does not offer is dropped.
    expect(readAccountsSearch({ onpage: '25' })).toEqual({});
    expect(readAccountsSearch({ onpage: 30 })).toEqual({});
  });

  it('asks the api for the days the reader picked, in the reader’s zone, the last one whole', () => {
    const path = logApiPath(
      logViewOf({ operator: OPERATOR, action: 'admin.invitation.issued', from: '2026-09-01', to: '2026-09-13' }),
    );
    const params = new URL(path, 'https://api.example').searchParams;

    expect(params.get('operator')).toBe(OPERATOR);
    expect(params.get('action')).toBe('admin.invitation.issued');
    expect(Number(params.get('from'))).toBe(new Date(2026, 8, 1).getTime());
    // Exclusive at the api, so the start of the day after the last one picked.
    expect(Number(params.get('to'))).toBe(new Date(2026, 8, 14).getTime());
    // No size chosen is the console's default of 25 (task 170).
    expect(params.get('onpage')).toBe('25');
  });

  it('asks the api for the page size the address holds', () => {
    const params = new URL(logApiPath(logViewOf({ page: 2, onpage: 100 })), 'https://api.example').searchParams;
    expect(params.get('page')).toBe('2');
    expect(params.get('onpage')).toBe('100');
  });

  it('rolls the last day over a month’s end', () => {
    const params = new URL(logApiPath(logViewOf({ to: '2026-09-30' })), 'https://api.example').searchParams;
    expect(Number(params.get('to'))).toBe(new Date(2026, 9, 1).getTime());
  });

  it('asks for no filter it was not given', () => {
    const params = new URL(logApiPath(logViewOf({})), 'https://api.example').searchParams;
    expect([...params.keys()].sort()).toEqual(['onpage', 'page']);
  });

  it('tells a filtered log from an unfiltered one', () => {
    expect(logIsFiltered(logViewOf({}))).toBe(false);
    expect(logIsFiltered(logViewOf({ from: '2026-09-01' }))).toBe(true);
  });

  it('starts new filters on the first page, and a page change keeps the filters', () => {
    const paged = { action: 'admin.account.removed' as const, page: 4 };
    expect(withLogFilters(paged, { operator: OPERATOR, action: null, from: null, to: null })).toEqual({
      operator: OPERATOR,
    });
    expect(withLogPage(paged, 2)).toEqual({ action: 'admin.account.removed', page: 2 });
  });

  it('starts a new page size on the first page, and keeps the filters, the size chosen and the open record', () => {
    const paged = { selected: 'row-1', action: 'admin.account.removed' as const, page: 4, onpage: 50 as const };
    expect(withLogPageSize(paged, 100)).toEqual({ selected: 'row-1', action: 'admin.account.removed', onpage: 100 });
    // Back to the default writes no size at all: one view, one address.
    expect(withLogPageSize(paged, 25)).toEqual({ selected: 'row-1', action: 'admin.account.removed' });
    // New filters keep the size, since it is a choice about the log and not about what it matches.
    expect(withLogFilters(paged, { operator: null, action: null, from: '2026-09-01', to: null })).toEqual({
      selected: 'row-1',
      from: '2026-09-01',
      onpage: 50,
    });
  });

  it('reads a submitted filter form the way it reads an address, *any* meaning no filter', () => {
    const form = new FormData();
    form.set('operator', OPERATOR);
    form.set('action', 'any');
    form.set('from', '2026-09-01');
    form.set('to', '');
    expect(logFiltersFromForm(form)).toEqual({ operator: OPERATOR, action: null, from: '2026-09-01', to: null });

    const tampered = new FormData();
    tampered.set('operator', 'not-an-id');
    tampered.set('action', 'admin.account.deleted');
    tampered.set('from', 'yesterday');
    expect(logFiltersFromForm(tampered)).toEqual({ operator: null, action: null, from: null, to: null });
  });

  it('opens one dialogue over the roster: a record or the invitation form', () => {
    expect(withInvitePanel({ selected: 'row-1' }, true)).toEqual({ panel: 'invite' });
    expect(withSelected({ panel: 'invite' }, 'row-2')).toEqual({ selected: 'row-2' });
    expect(withSelected({ selected: 'row-2' }, null)).toEqual({});
  });
});
