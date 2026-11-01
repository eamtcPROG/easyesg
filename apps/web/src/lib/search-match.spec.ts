import { describe, expect, it } from 'vitest';
import { matchesSearch } from './search-match';

describe('matchesSearch (task 203.2)', () => {
  it('matches anywhere in any field, ignoring case', () => {
    expect(matchesSearch({ term: 'lina', fields: ['Brutăria Lina SRL', 2026] })).toBe(true);
    expect(matchesSearch({ term: '2026', fields: ['Brutăria Lina SRL', 2026] })).toBe(true);
    expect(matchesSearch({ term: 'BRUT', fields: ['Brutăria Lina SRL'] })).toBe(true);
  });

  it('matches nothing a field does not hold, and skips an absent field', () => {
    expect(matchesSearch({ term: 'apa', fields: ['Brutăria Lina SRL', null] })).toBe(false);
  });

  it('matches everything for no term', () => {
    expect(matchesSearch({ term: '', fields: [null] })).toBe(true);
  });
});
