import { describe, expect, it } from 'vitest';
import { countryOptions, defaultCountry } from './countries';

describe('countryOptions', () => {
  it('names each registered country in the reader’s language, and a code with no wording by its code', () => {
    expect(
      countryOptions({
        vocabulary: [
          { countryCode: 'MD', legalForms: [] },
          { countryCode: 'RO', legalForms: [] },
        ],
        labels: { MD: 'Republica Moldova' },
      }),
    ).toEqual([
      { value: 'MD', label: 'Republica Moldova' },
      { value: 'RO', label: 'RO' },
    ]);
  });
});

describe('defaultCountry', () => {
  it('starts a new site in the one registered country, and in none where there are several', () => {
    expect(defaultCountry([{ value: 'MD', label: 'Republica Moldova' }])).toBe('MD');
    expect(
      defaultCountry([
        { value: 'MD', label: 'Republica Moldova' },
        { value: 'RO', label: 'România' },
      ]),
    ).toBe('');
    expect(defaultCountry([])).toBe('');
  });
});
