import { negotiateLocale } from './negotiate-locale';

describe('negotiateLocale', () => {
  it('falls back to the source locale when no header is sent', () => {
    expect(negotiateLocale(undefined)).toBe('ro');
    expect(negotiateLocale('')).toBe('ro');
  });

  it('returns an exactly supported language', () => {
    expect(negotiateLocale('en')).toBe('en');
    expect(negotiateLocale('ru')).toBe('ru');
  });

  it('folds a region subtag to its language', () => {
    // A Moldovan browser sends ro-MD. Falling through to source would look identical here,
    // because Romanian IS source — so this is the assertion that keeps that bug visible.
    expect(negotiateLocale('ro-MD')).toBe('ro');
    expect(negotiateLocale('en-GB,en;q=0.9')).toBe('en');
  });

  it('honours q-ordering rather than header order', () => {
    expect(negotiateLocale('en;q=0.2, ru;q=0.9')).toBe('ru');
  });

  it('treats q=0 as refusal, not lowest preference', () => {
    // The trap a hand-rolled sort falls into: serving a locale the caller explicitly refused.
    expect(negotiateLocale('en;q=0, ru;q=0.5')).toBe('ru');
  });

  it('skips unsupported languages and takes the best supported one', () => {
    expect(negotiateLocale('de, fr;q=0.9, ru;q=0.1')).toBe('ru');
  });

  it('answers the wildcard with the source locale', () => {
    expect(negotiateLocale('*')).toBe('ro');
  });

  it('falls back when nothing is supported', () => {
    expect(negotiateLocale('de, fr, ja')).toBe('ro');
  });
});
