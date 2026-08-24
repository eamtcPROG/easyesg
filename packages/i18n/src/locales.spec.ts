import { describe, expect, it } from 'vitest';
import { SOURCE_LOCALE, isLocale, toLocale } from './locales.js';

/**
 * The two narrowings, and the difference between them — which is the whole reason they are here
 * rather than copied into each consumer. Six private copies existed before 24 Aug 2026 (three
 * repositories, two queue handlers, the web session codec) and the locale-negotiation site had
 * quietly grown the *other* semantics, which no copy's tests could have caught.
 *
 * Literals are asserted on purpose, per the tests exception in CLAUDE.md's closed-vocabulary
 * rule: these are the persisted and transported values, and a spec written in constants would
 * not break if someone renamed one.
 */
describe('isLocale', () => {
  it.each(['ro', 'en', 'ru'])('accepts the live locale %p', (value) => {
    expect(isLocale(value)).toBe(true);
  });

  // `de` is the retired/unregistered case, `ro-MD` the region subtag one: `negotiateLocale`
  // folds subtags to their language BEFORE testing, so this predicate must not do it silently —
  // a predicate that accepted `ro-MD` would make that folding untestable at its own site.
  it.each(['de', 'ro-MD', 'RO', '', ' ro', undefined, null, 0, {}])(
    'refuses %p',
    (value) => {
      expect(isLocale(value)).toBe(false);
    },
  );
});

describe('toLocale', () => {
  it('returns a live locale unchanged', () => {
    expect(toLocale('ru')).toBe('ru');
  });

  // The fallback is the point: a locale retired after rows were written in it (NFR-25 makes the
  // set configuration) must not strand the account, the email or the session.
  it.each(['de', 'ro-MD', '', undefined, null, 42])(
    'falls back to the source locale for %p',
    (value) => {
      expect(toLocale(value)).toBe(SOURCE_LOCALE);
    },
  );

  it('agrees with isLocale on every input', () => {
    for (const value of ['ro', 'en', 'ru', 'de', '', undefined, null, 7]) {
      expect(toLocale(value) === value).toBe(isLocale(value));
    }
  });
});
