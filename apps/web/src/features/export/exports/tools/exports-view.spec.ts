import { describe, expect, it } from 'vitest';
import { buildListQuery, type ListQuery } from '@/lib/pagination';
import {
  COMPLETED_EXPORTS_QUERY,
  DEFAULT_EXPORTS_VIEW,
  exportsListQuery,
  exportsViewQuery,
  readExportsView,
} from './exports-view';

/** The query as the api reads it — the separators decoded, which `URLSearchParams` escapes. */
const asked = (query: ListQuery): string => decodeURIComponent(buildListQuery(query));

/** S-11's history as an address (task 47.3): read back, written out, and asked of the api. */
describe('the history view', () => {
  it('reads a view from the address and writes the same address back', () => {
    const view = readExportsView({ format: 'xlsx', language: 'en', dir: 'asc', page: '2', onpage: '50' });
    expect(view).toEqual({ format: 'xlsx', language: 'en', direction: 'asc', page: 2, pageSize: 50 });
    expect(exportsViewQuery(view)).toBe('format=xlsx&language=en&dir=asc&page=2&onpage=50');
  });

  it('falls back to the default for anything it cannot read, and writes the default as no query at all', () => {
    const view = readExportsView({ format: 'xbrl', language: 'de', dir: 'sideways', page: '-3', onpage: '7' });
    expect(view).toEqual(DEFAULT_EXPORTS_VIEW);
    expect(exportsViewQuery(view)).toBe('');
  });

  it('asks the api for the facets it names, newest first by default, and never sends the *any* sentinel', () => {
    expect(asked(exportsListQuery(DEFAULT_EXPORTS_VIEW))).toBe('order=requested,desc&page=1&onpage=25');
    expect(asked(exportsListQuery({ ...DEFAULT_EXPORTS_VIEW, format: 'pdf', language: 'ru' }))).toBe(
      'filters=format,pdf|language,ru&order=requested,desc&page=1&onpage=25',
    );
  });

  it('asks the whole history one row of its completed exports — what decides whether the mark is offered', () => {
    expect(asked(COMPLETED_EXPORTS_QUERY)).toBe('filters=status,completed&onpage=1');
  });
});
