import { LOCALES, SOURCE_LOCALE, type Locale } from './locales.js';

/**
 * Which locales a reader is offered (task 67.16; FR-63 behaviour 6; 182/46): **those whose catalogue is in the build
 * and whose registration is published**. `LOCALES` stays the build's registry — what has a catalogue — and the
 * `locale_registration` artefact says which of them the platform offers, so a built locale nobody registered is not
 * offered, and a registered code with no catalogue behind it is not offered either. The registry's order is kept.
 */
export const offeredLocales = (input: { readonly registered: readonly string[] }): readonly Locale[] =>
  LOCALES.filter((locale) => input.registered.includes(locale));

/** One locale of the registration artefact: its code, and whether it is the source the others are translated from. */
export interface LocaleRegistrationEntry {
  readonly code: string;
  readonly source: boolean;
}

/**
 * The `locale_registration` artefact read (task 67.16) — `{ locales: [{ code, source }] }` — or `null` for a payload it
 * cannot read: a code that is not two lower-case letters, a code named twice, or a registration whose one source is not
 * the platform's source locale. **The source must be registered**: every other locale is translated from it, and a
 * registration without it would offer translations of nothing. The publication rule and the reader are this one
 * function, so the store admits only what the reader reads.
 */
export const readLocaleRegistration = (payload: unknown): readonly LocaleRegistrationEntry[] | null => {
  if (typeof payload !== 'object' || payload === null || !('locales' in payload)) return null;
  const { locales } = payload;
  if (!Array.isArray(locales)) return null;

  const entries: LocaleRegistrationEntry[] = [];
  for (const entry of locales as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const { code, source } = entry as { code?: unknown; source?: unknown };
    if (typeof code !== 'string' || !/^[a-z]{2}$/u.test(code) || typeof source !== 'boolean') return null;
    if (entries.some((known) => known.code === code)) return null;
    entries.push({ code, source });
  }

  const sources = entries.filter((entry) => entry.source);
  if (sources.length !== 1 || sources[0].code !== SOURCE_LOCALE) return null;
  return entries;
};
