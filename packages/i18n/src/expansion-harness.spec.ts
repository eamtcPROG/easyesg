import { describe, expect, it } from 'vitest';
import {
  EXPANSION_FACTOR,
  expandCatalogue,
  expandString,
  expansionEnabled,
} from './expansion-harness.js';

describe('expansionEnabled', () => {
  it('accepts only the exact string "1"', () => {
    expect(expansionEnabled('1')).toBe(true);
  });

  // The reason this is not a truthiness check. '0' and 'false' are both truthy strings, and a
  // harness that pads every label in production because someone wrote EASYESG_PSEUDOLOCALE=false
  // is a worse outage than the layout bug it exists to catch.
  it.each(['0', 'false', 'true', 'yes', '', ' 1', '1 ', undefined])(
    'refuses %p',
    (value) => {
      expect(expansionEnabled(value)).toBe(false);
    },
  );
});

describe('expandString', () => {
  it('pads to at least the UX-94 budget of +40%', () => {
    const source = 'Raportare de sustenabilitate';
    const expanded = expandString(source);

    expect(expanded.startsWith(source)).toBe(true);
    expect(expanded.length / source.length).toBeGreaterThanOrEqual(EXPANSION_FACTOR);
  });

  it('leaves an empty string alone', () => {
    // Padding '' would turn an intentionally blank value into visible glyphs, which reads as
    // content rather than as the absence the parity gate is meant to flag.
    expect(expandString('')).toBe('');
  });

  it('expands Cyrillic and Romanian diacritics by character count, not byte length', () => {
    // A byte-length implementation would under-pad Latin and over-pad Cyrillic, so the budget
    // would be wrong for exactly the two locales it exists to protect.
    const ro = expandString('Salvează');
    const ru = expandString('Сохранить');

    expect(ro.length / 'Salvează'.length).toBeGreaterThanOrEqual(EXPANSION_FACTOR);
    expect(ru.length / 'Сохранить'.length).toBeGreaterThanOrEqual(EXPANSION_FACTOR);
  });
});

describe('expandCatalogue', () => {
  it('expands every leaf while preserving the catalogue shape', () => {
    const source = { chrome: { error: { title: 'Eroare', action: 'Reîncercați' } } };
    const expanded = expandCatalogue(source);

    expect(Object.keys(expanded.chrome.error)).toEqual(['title', 'action']);
    expect(expanded.chrome.error.title.startsWith('Eroare')).toBe(true);
    expect(expanded.chrome.error.action.length).toBeGreaterThan('Reîncercați'.length);
  });

  it('does not mutate the catalogue it was given', () => {
    // The loader holds one imported catalogue object for the process lifetime. Mutating it would
    // leak pseudolocalized text into every subsequent request, including with the flag off.
    const source = { chrome: { probe: 'Text' } };
    expandCatalogue(source);

    expect(source.chrome.probe).toBe('Text');
  });
});
