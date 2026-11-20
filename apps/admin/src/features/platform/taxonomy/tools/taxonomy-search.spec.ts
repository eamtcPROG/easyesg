import { describe, expect, it } from 'vitest';
import { diffLocaleOf, openPair, readTaxonomySearch } from './taxonomy-search';

describe('A-04’s address (task 67.6)', () => {
  it('keeps a well-formed pair that moves forward, and a known locale', () => {
    expect(readTaxonomySearch({ from: '2026-02-01', to: '2026-05-01', locale: 'en' })).toEqual({
      from: '2026-02-01',
      to: '2026-05-01',
      locale: 'en',
    });
  });

  it('reads a malformed or backward pair, or an unknown locale, as no choice', () => {
    expect(readTaxonomySearch({ from: '2026-05-01', to: '2026-02-01' })).toEqual({});
    expect(readTaxonomySearch({ from: 'x', to: '2026-02-01', locale: 'de' })).toEqual({});
  });

  it('opens the address’s pair, or the latest two versions, or none', () => {
    expect(openPair({ search: { from: '2026-02-01', to: '2026-05-01' }, versions: [] })).toEqual({ from: '2026-02-01', to: '2026-05-01' });
    expect(openPair({ search: {}, versions: ['2026-05-01', '2025-01-01', '2026-02-01'] })).toEqual({ from: '2026-02-01', to: '2026-05-01' });
    expect(openPair({ search: {}, versions: ['2026-05-01'] })).toBeNull();
    expect(diffLocaleOf({})).toBe('ro');
  });
});
