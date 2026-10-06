import { describe, expect, it } from 'vitest';
import { namePartIsPresent, presentNamePart } from './name-part';

/**
 * 182/6's rule at its edges. The api refuses with `presentNamePart` and the browser judges with `namePartIsPresent`,
 * so a case pinned here holds at both sites at once — which is the point of the shared home.
 */
describe('name part (FR-9, 182/6)', () => {
  it('keeps a name, trimmed, so a stray space never reaches a greeting', () => {
    expect(presentNamePart('Ana')).toBe('Ana');
    expect(presentNamePart('  Ana Maria ')).toBe('Ana Maria');
  });

  it('counts a part of white space as absent — spaces, a tab, a line break, a no-break space', () => {
    for (const blank of ['', ' ', '   ', '\t', '\n', ' ', '  \t ']) {
      expect(presentNamePart(blank)).toBeNull();
      expect(namePartIsPresent(blank)).toBe(false);
    }
  });

  it('counts a part the account never held as absent', () => {
    expect(presentNamePart(null)).toBeNull();
    expect(presentNamePart(undefined)).toBeNull();
    expect(namePartIsPresent(null)).toBe(false);
  });

  it('keeps a Romanian or Russian name as typed, since only its edges are trimmed', () => {
    expect(presentNamePart(' Ștefan ')).toBe('Ștefan');
    expect(presentNamePart('Иванова')).toBe('Иванова');
    expect(namePartIsPresent('Ș')).toBe(true);
  });
});
