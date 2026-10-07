import { narrowSearchTerm } from './search-term';

describe('narrowSearchTerm', () => {
  it('trims, cuts to its bound, and reads nothing left as no search', () => {
    expect(narrowSearchTerm({ raw: '  Lina SRL, Chișinău  ', maxLength: 100 })).toBe('Lina SRL, Chișinău');
    expect(narrowSearchTerm({ raw: 'x'.repeat(140), maxLength: 100 })).toHaveLength(100);
    expect(narrowSearchTerm({ raw: '   ', maxLength: 100 })).toBeNull();
  });

  it('reads anything but one string as no search', () => {
    expect(narrowSearchTerm({ raw: undefined, maxLength: 100 })).toBeNull();
    expect(narrowSearchTerm({ raw: ['a', 'b'], maxLength: 100 })).toBeNull();
  });
});
