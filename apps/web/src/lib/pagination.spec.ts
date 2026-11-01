import { describe, expect, it } from 'vitest';
import { buildListQuery, ON_PAGE_ALL } from './pagination';

/**
 * `buildListQuery` must be the exact inverse of `apps/api`'s `ListQueryInterceptor`, whose
 * grammar is: pipe separates groups, comma separates values inside one group, and there is no
 * escaping. The strings pinned here are the wire values — they must break if either side's
 * separators move.
 *
 * `URLSearchParams` percent-encodes the separators; that is invisible to the parser, which
 * splits AFTER Express decodes. The assertions decode before comparing so they pin the
 * post-decode wire form the interceptor actually sees.
 */
const decoded = (query: Parameters<typeof buildListQuery>[0]) =>
  decodeURIComponent(buildListQuery(query));

describe('buildListQuery (§6.8 compact list format)', () => {
  it('builds nothing from nothing — the defaults live server-side', () => {
    expect(buildListQuery()).toBe('');
    expect(buildListQuery({})).toBe('');
    expect(buildListQuery({ filters: [], order: [] })).toBe('');
  });

  it('builds the documented example shape', () => {
    expect(
      decoded({
        filters: [
          { field: 'field', values: ['v1', 'v2'] },
          { field: 'field2', values: ['v3'] },
        ],
        order: [{ field: 'field', direction: 'asc' }],
        page: 1,
        onpage: 25,
      }),
    ).toBe('filters=field,v1,v2|field2,v3&order=field,asc&page=1&onpage=25');
  });

  it('joins multiple sort criteria the way the parser splits them', () => {
    expect(
      decoded({
        order: [
          { field: 'name', direction: 'asc' },
          { field: 'createdAt', direction: 'desc' },
        ],
      }),
    ).toBe('order=name,asc|createdAt,desc');
  });

  it('carries numeric filter values as their string form', () => {
    expect(decoded({ filters: [{ field: 'year', values: [2026] }] })).toBe('filters=year,2026');
  });

  it('passes the all-rows sentinel through for bounded routes', () => {
    expect(decoded({ onpage: ON_PAGE_ALL })).toBe('onpage=-1');
  });

  it('refuses a value containing a separator — the grammar has no escaping', () => {
    expect(() => buildListQuery({ filters: [{ field: 'name', values: ['a,b'] }] })).toThrow(
      /no escaping/,
    );
    expect(() => buildListQuery({ filters: [{ field: 'na|me', values: ['x'] }] })).toThrow(
      /no escaping/,
    );
  });
});
