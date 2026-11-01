import { describe, expect, it } from 'vitest';
import { carriesNoStanding, initialExportLanguage, recommendedLanguage } from './export-languages';

/** At `2026-05-01` EFRAG publishes English alone (T-14); the api answers it per language (task 47.3). */
const LANGUAGES = [
  { locale: 'ro', labelStanding: 'platform_authored' },
  { locale: 'en', labelStanding: 'official' },
  { locale: 'ru', labelStanding: 'platform_authored' },
] as const;

describe('the export language (FR-52, UX-47)', () => {
  it("starts from the account's export language, else the reader's, else the source language", () => {
    expect(initialExportLanguage({ exportLocale: 'en', reader: 'ru' })).toBe('en');
    expect(initialExportLanguage({ exportLocale: null, reader: 'ru' })).toBe('ru');
    expect(initialExportLanguage({ exportLocale: null, reader: 'de' })).toBe('ro');
  });

  it('says a language carries no standing only where the api calls its labels platform-authored', () => {
    expect(carriesNoStanding({ languages: LANGUAGES, locale: 'ro' })).toBe(true);
    expect(carriesNoStanding({ languages: LANGUAGES, locale: 'en' })).toBe(false);
    expect(carriesNoStanding({ languages: [], locale: 'ru' })).toBe(false);
    expect(carriesNoStanding({ languages: [{ locale: 'ru', labelStanding: null }], locale: 'ru' })).toBe(false);
  });

  it('recommends the language whose labels are EFRAG’s own, and none where no language has them', () => {
    expect(recommendedLanguage(LANGUAGES)).toBe('en');
    expect(recommendedLanguage(LANGUAGES.filter((language) => language.locale !== 'en'))).toBeNull();
  });
});
