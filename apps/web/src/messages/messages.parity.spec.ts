import { describe, expect, it } from 'vitest';
import {
  SOURCE_LOCALE,
  blankKeys,
  compareToSource,
  type Locale,
  type MessageCatalogue,
} from '@easyesg/i18n';
import en from './en.json';
import ro from './ro.json';
import ru from './ru.json';

/**
 * Guards this app's **chrome** catalogue only.
 *
 * Everything domain-shaped — validation findings, notification text, disclosure labels — lives
 * in `packages/i18n/catalogues` and is guarded by that package's own parity suite. What is left
 * here is the text that exists because a screen exists.
 */

const CATALOGUES: Readonly<Record<Locale, MessageCatalogue>> = { ro, en, ru };
const TRANSLATIONS = (Object.keys(CATALOGUES) as Locale[]).filter((l) => l !== SOURCE_LOCALE);

describe('chrome catalogue', () => {
  it('covers every registered locale', () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual(['en', 'ro', 'ru']);
  });

  it.each(TRANSLATIONS)('matches the source key space in %s', (locale) => {
    expect(compareToSource(CATALOGUES[SOURCE_LOCALE], CATALOGUES[locale])).toEqual({
      missing: [],
      unexpected: [],
    });
  });

  it.each(Object.keys(CATALOGUES) as Locale[])('declares no empty string in %s', (locale) => {
    expect(blankKeys(CATALOGUES[locale])).toEqual([]);
  });
});
