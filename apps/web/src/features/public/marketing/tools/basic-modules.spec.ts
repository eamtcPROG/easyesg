import { describe, expect, it } from 'vitest';
import { LOCALES } from '@easyesg/i18n';
import sharedEn from '@easyesg/i18n/catalogues/en.json';
import sharedRo from '@easyesg/i18n/catalogues/ro.json';
import sharedRu from '@easyesg/i18n/catalogues/ru.json';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import ru from '@/messages/ru.json';
import { BASIC_MODULES } from './basic-modules';

/**
 * The eleven sections the home names are the report's eleven, in the report's words, in every locale (task 74.3).
 *
 * Read from the catalogues themselves rather than through a render: a code missing from either catalogue renders as
 * nothing at all — `getMessageFallback` answers `''` by UX-97 — so a page could lose a section with no error anywhere.
 */
const SHARED = { ro: sharedRo, en: sharedEn, ru: sharedRu } as const;
const OWN = { ro, en, ru } as const;

describe('BASIC_MODULES', () => {
  it('is the Basic Module’s eleven, in order', () => {
    expect(BASIC_MODULES).toEqual(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11']);
  });

  it.each(LOCALES)('each has the exported report’s name in %s', (locale) => {
    const names: Readonly<Record<string, string>> = SHARED[locale].core.export.document.modules;
    for (const code of BASIC_MODULES) expect(names[code], code).toMatch(/\S/);
  });

  it.each(LOCALES)('each says what it asks about in %s, and nothing else is said', (locale) => {
    const about: Readonly<Record<string, string>> = OWN[locale].marketing.sections.about;
    expect(Object.keys(about)).toEqual([...BASIC_MODULES]);
    for (const code of BASIC_MODULES) expect(about[code], code).toMatch(/\S/);
  });
});
