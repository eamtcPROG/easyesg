import { describe, expect, it } from 'vitest';
import {
  readRegisterSearch,
  registerApiPath,
  registerViewOf,
  withPage,
  withPageSize,
  withSearch,
  withSelected,
  withSort,
} from './register-search';

/**
 * A-02's address (task 67.3; UX-4). Literals on purpose: `sort=activity`, `direction=desc` and the
 * api's `order=activity,desc` are wire values a renamed constant must not silently move.
 */
describe('readRegisterSearch', () => {
  it('keeps what it can read', () => {
    expect(
      readRegisterSearch({ q: '  Lina ', sort: 'activity', direction: 'desc', page: 3, selected: 'abc' }),
    ).toEqual({ q: 'Lina', sort: 'activity', direction: 'desc', page: 3, selected: 'abc' });
  });

  it('drops what it cannot, and never writes a default', () => {
    expect(
      readRegisterSearch({ q: '   ', sort: 'plan', direction: 'sideways', page: 1, selected: '' }),
    ).toEqual({});
    expect(readRegisterSearch({ page: '0' })).toEqual({});
    expect(readRegisterSearch({ page: 'two' })).toEqual({});
  });

  it('reads a page that arrives as text', () => {
    expect(readRegisterSearch({ page: '4' })).toEqual({ page: 4 });
  });

  it('keeps an offered page size and drops the default and anything else', () => {
    expect(readRegisterSearch({ onpage: '100' })).toEqual({ onpage: 100 });
    expect(readRegisterSearch({ onpage: '25' })).toEqual({});
    expect(readRegisterSearch({ onpage: '-1' })).toEqual({});
  });
});

describe('registerViewOf and registerApiPath', () => {
  it('resolves a bare address to the default view and its api path', () => {
    const view = registerViewOf({});
    expect(view).toEqual({
      search: '',
      sort: 'name',
      direction: 'asc',
      page: 1,
      pageSize: 25,
      selected: null,
    });
    expect(registerApiPath(view)).toBe('/admin/organizations?order=name%2Casc&page=1&onpage=25');
  });

  it('asks the api for the search, order and page the view holds', () => {
    const path = registerApiPath(
      registerViewOf({ q: 'Lina, SRL', sort: 'activity', direction: 'desc', page: 2, onpage: 100 }),
    );
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('search')).toBe('Lina, SRL');
    expect(params.get('order')).toBe('activity,desc');
    expect(params.get('page')).toBe('2');
    expect(params.get('onpage')).toBe('100');
  });
});

describe('the board’s transitions', () => {
  const open = { q: 'Lina', sort: 'reports', direction: 'desc', page: 3, selected: 'abc' } as const;

  it('a new search returns to the first page and closes the record', () => {
    expect(withSearch(open, 'Beta')).toEqual({ q: 'Beta', sort: 'reports', direction: 'desc' });
  });

  it('a new order returns to the first page and keeps the record open', () => {
    expect(withSort(open, { column: 'name', direction: 'asc' })).toEqual({
      q: 'Lina',
      sort: 'name',
      direction: 'asc',
      selected: 'abc',
    });
  });

  it('a new page closes the record, and page 1 is not written', () => {
    expect(withPage(open, 1)).toEqual({ q: 'Lina', sort: 'reports', direction: 'desc' });
    expect(withPage(open, 5)).toMatchObject({ page: 5 });
  });

  it('a new page size returns to the first page and closes the record', () => {
    expect(withPageSize(open, 50)).toEqual({ q: 'Lina', sort: 'reports', direction: 'desc', onpage: 50 });
    expect(withPageSize({ onpage: 100 }, 25)).toEqual({});
  });

  it('opens and closes a record without touching the rest', () => {
    expect(withSelected({ q: 'Lina' }, 'xyz')).toEqual({ q: 'Lina', selected: 'xyz' });
    expect(withSelected(open, null)).not.toHaveProperty('selected');
  });
});
