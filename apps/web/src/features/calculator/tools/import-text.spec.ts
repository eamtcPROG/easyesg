import { describe, expect, it } from 'vitest';
import { holdsWords, matchText, wordsOf } from './import-text';

describe('matchText', () => {
  it('sets case, Romanian accents and punctuation aside', () => {
    expect(matchText('GAZE NATURALE')).toBe('gaze naturale');
    expect(matchText('Motorină pentru încălzire')).toBe('motorina pentru incalzire');
    expect(matchText('Locația / Sediul')).toBe('locatia sediul');
    expect(matchText('natural_gas')).toBe('natural gas');
    expect(matchText('  U.M.  ')).toBe('u m');
  });

  it('reads a superscript unit as its digits', () => {
    expect(matchText('m³')).toBe('m3');
  });

  it('keeps Cyrillic letters, accents aside', () => {
    expect(matchText('Природный ГАЗ')).toBe('природныи газ');
  });
});

describe('wordsOf', () => {
  it('reads a comma-separated list, dropping what is blank', () => {
    expect(wordsOf('Sursă, tip energie, , Combustibil')).toEqual(['sursa', 'tip energie', 'combustibil']);
  });
});

describe('holdsWords', () => {
  it('matches whole words only', () => {
    expect(holdsWords({ text: 'unitate de masura', phrase: 'unitate' })).toBe(true);
    expect(holdsWords({ text: 'unitate de masura', phrase: 'de masura' })).toBe(true);
    expect(holdsWords({ text: 'unitate de masura', phrase: 'unit' })).toBe(false);
  });
});
