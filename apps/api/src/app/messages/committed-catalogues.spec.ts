import { isWordedInEveryLocale } from './committed-catalogues';

describe('isWordedInEveryLocale', () => {
  it('answers yes for a leaf every locale words', () => {
    expect(isWordedInEveryLocale('validation.required')).toBe(true);
    expect(isWordedInEveryLocale('validation.sum.over')).toBe(true);
  });

  it('answers no for a namespace, which renders nothing, and for a key no catalogue holds', () => {
    expect(isWordedInEveryLocale('validation.sum')).toBe(false);
    expect(isWordedInEveryLocale('validation.nowhere')).toBe(false);
  });
});
