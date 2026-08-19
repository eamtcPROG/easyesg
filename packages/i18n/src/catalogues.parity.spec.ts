import { describe, expect, it } from 'vitest';
import en from '../catalogues/en.json';
import ro from '../catalogues/ro.json';
import ru from '../catalogues/ru.json';
import { SOURCE_LOCALE, type Locale } from './locales.js';
import { blankKeys, compareToSource } from './parity.js';
import type { MessageCatalogue } from './messages.js';

/**
 * Guards the shared catalogues — the text `apps/api` resolves before it reaches the wire, and
 * that the shared validation interpreter (§9.8) renders in `apps/web` too.
 *
 * Romanian is the source (NFR-23), so it defines the key space in both directions: a key it
 * lacks is an extension, and an extension is how a translator's guess becomes a fact nobody
 * authored. Machine translation is prohibited (FR-63), and a key appearing first in `ru.json`
 * is what that prohibition looks like when it is being broken.
 *
 * **Imported, not read off disk.** This package sets `"types": []` to stay isomorphic — no Node
 * API, so it runs in a browser, a worker and an edge runtime alike — and `node:fs` would end
 * that. Importing also tests something a filesystem read does not: that the catalogues are
 * resolvable the way every consumer actually loads them.
 */

const CATALOGUES: Readonly<Record<Locale, MessageCatalogue>> = { ro, en, ru };
const TRANSLATIONS = (Object.keys(CATALOGUES) as Locale[]).filter((l) => l !== SOURCE_LOCALE);

describe('shared catalogues', () => {
  it('covers every registered locale', () => {
    // Guards the failure this whole suite is blind to otherwise: a locale added to the registry
    // with no catalogue behind it would simply not be compared here.
    expect(Object.keys(CATALOGUES).sort()).toEqual(['en', 'ro', 'ru']);
  });

  it.each(TRANSLATIONS)('matches the source key space in %s', (locale) => {
    // Two named sets rather than a bare inequality: "missing" is a translation still to write,
    // "unexpected" is a rename applied to one file only — or a key someone invented.
    expect(compareToSource(CATALOGUES[SOURCE_LOCALE], CATALOGUES[locale])).toEqual({
      missing: [],
      unexpected: [],
    });
  });

  it.each(Object.keys(CATALOGUES) as Locale[])('declares no empty string in %s', (locale) => {
    // An empty value passes a key-set comparison and renders as nothing — the same blank UX-97
    // makes invisible. Placeholder-by-omission is what this catches.
    expect(blankKeys(CATALOGUES[locale])).toEqual([]);
  });
});
