import { displayName, monogram } from './display-name';

/**
 * UX-137's four cases, asserted rather than described.
 *
 * Task 139's deliverable names them: *"the derivation's spec covers both orders and both absences"*.
 * They matter because the schema permits every one of them — the columns are nullable so that a
 * provider sign-up and the rows that predate this migration are representable — so a fallback that
 * was never exercised is a fallback that fails the first time a real account reaches it.
 */
const ADDRESS = 'ana.popescu@example.md';

describe('displayName (UX-137)', () => {
  it('puts the given name first, which is the order all three locales share', () => {
    expect(displayName({ givenName: 'Ana', familyName: 'Popescu' }, ADDRESS)).toBe('Ana Popescu');
  });

  it('stands the given name alone when the family name is absent', () => {
    expect(displayName({ givenName: 'Ana', familyName: null }, ADDRESS)).toBe('Ana');
  });

  it('stands the family name alone when the given name is absent', () => {
    expect(displayName({ givenName: null, familyName: 'Popescu' }, ADDRESS)).toBe('Popescu');
  });

  it('falls back to the address when neither is set', () => {
    expect(displayName({ givenName: null, familyName: null }, ADDRESS)).toBe(ADDRESS);
  });

  /**
   * The schema's `CHECK` rejects an empty string, so this should be unreachable through the API —
   * but a whitespace-only value would pass `char_length(' ') = 1` and is not a name. Treating it as
   * absent here means the fallback fires rather than a surface rendering a blank where a person
   * should be.
   */
  it('treats a whitespace-only part as absent rather than as a name', () => {
    expect(displayName({ givenName: '   ', familyName: 'Popescu' }, ADDRESS)).toBe('Popescu');
    expect(displayName({ givenName: ' ', familyName: '\t' }, ADDRESS)).toBe(ADDRESS);
  });

  it('trims, so a stray space never reaches a greeting', () => {
    expect(displayName({ givenName: ' Ana ', familyName: ' Popescu ' }, ADDRESS)).toBe('Ana Popescu');
  });
});

describe('monogram (UX-137)', () => {
  it('takes the first character of each part present', () => {
    expect(monogram({ givenName: 'Ana', familyName: 'Popescu' })).toBe('AP');
  });

  it('gives one character when only one part is set', () => {
    expect(monogram({ givenName: 'Ana', familyName: null })).toBe('A');
    expect(monogram({ givenName: null, familyName: 'Popescu' })).toBe('P');
  });

  /**
   * The instruction that is easiest to get wrong, so it is pinned: **no initial from the address**.
   * A letter taken from an email reads as a name the person never gave; `null` lets the surface
   * show its glyph and say nothing false.
   */
  it('gives nothing at all when neither part is set, rather than an initial from the address', () => {
    expect(monogram({ givenName: null, familyName: null })).toBeNull();
    expect(monogram({ givenName: '  ', familyName: null })).toBeNull();
  });

  it('folds to upper case', () => {
    expect(monogram({ givenName: 'ana', familyName: 'popescu' })).toBe('AP');
  });

  it('folds Romanian and Russian initials, not only ASCII', () => {
    expect(monogram({ givenName: 'Ștefan', familyName: 'Țurcanu' })).toBe('ȘȚ');
    expect(monogram({ givenName: 'Анна', familyName: 'Петрова' })).toBe('АП');
  });

  /**
   * `[0]` on a JavaScript string indexes by UTF-16 code unit, so a name opening outside the basic
   * plane yields half a surrogate pair and renders as a replacement glyph. `Array.from` iterates
   * code points. Unlikely in these three locales and cheap to be right about.
   */
  it('takes a whole code point, not half a surrogate pair', () => {
    expect(monogram({ givenName: '𝒜nna', familyName: null })).toBe('𝒜');
  });
});
