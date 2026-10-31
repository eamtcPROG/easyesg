import { describe, expect, it } from 'vitest';
import { helpLanguageOf, helpLanguageQuery, languageOf } from './help-language';

describe('helpLanguageOf', () => {
  it('reads the language the address names', () => {
    expect(helpLanguageOf({ requested: 'ru', page: 'en' })).toBe('ru');
  });

  it('falls back to the page’s for none, an empty one, or one the platform does not publish in', () => {
    expect(helpLanguageOf({ requested: undefined, page: 'en' })).toBe('en');
    expect(helpLanguageOf({ requested: '', page: 'en' })).toBe('en');
    expect(helpLanguageOf({ requested: 'de', page: 'ro' })).toBe('ro');
  });
});

describe('helpLanguageQuery', () => {
  it('carries a language other than the page’s', () => {
    expect(helpLanguageQuery({ content: 'ru', page: 'en' })).toEqual({ content: 'ru' });
  });

  it('carries nothing for the page’s own, so the address stays as it was', () => {
    expect(helpLanguageQuery({ content: 'en', page: 'en' })).toEqual({});
  });
});

describe('languageOf', () => {
  it('marks a part written in another language than the page’s', () => {
    expect(languageOf({ written: 'ro', page: 'en' })).toBe('ro');
  });

  it('marks nothing written in the page’s language', () => {
    expect(languageOf({ written: 'en', page: 'en' })).toBeUndefined();
  });
});
