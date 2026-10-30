import { LOCALES, SOURCE_LOCALE, isLocale, type Locale } from '@easyesg/i18n';
import { type FieldRead, isRecord } from './content-payload';

/**
 * An item's text in each locale it carries (task 76; `architecture.md` §12.5.6's task-76 row (2), (4)). **The source
 * locale's is always there** — the store refuses an item without it — so a reader always has something to serve;
 * English and Russian are each there whole or not at all, so nobody meets half a translation (FR-62).
 */
export interface Localized<Text> {
  readonly source: Text;
  /** Each locale's text, the source's among them. A locale absent here falls back. */
  readonly byLocale: Readonly<Partial<Record<Locale, Text>>>;
}

/** The text a reader is served, the language it is in, and whether that is the one they asked for. */
export interface Served<Text> {
  readonly locale: Locale;
  readonly text: Text;
  /** The locale asked for had no text, so the source's is served — undecorated (UX-97), and reported (FR-64). */
  readonly fellBack: boolean;
}

/**
 * A payload's `locales` read with one block reader, or why the store refuses it: a locale the build does not register
 * (FR-63's registry is the code's — 182/46), a block its reader refuses, or no source text.
 */
export const readLocalized = <Text>(input: {
  readonly value: unknown;
  readonly readBlock: (block: unknown) => FieldRead<Text>;
}): FieldRead<Localized<Text>> => {
  if (!isRecord(input.value)) return { fault: 'carries no locales' };
  const byLocale: Partial<Record<Locale, Text>> = {};
  for (const [locale, block] of Object.entries(input.value)) {
    if (!isLocale(locale)) return { fault: `names "${locale}", a locale the build does not register` };
    const text = input.readBlock(block);
    if ('fault' in text) return { fault: `in ${locale}: ${text.fault}` };
    byLocale[locale] = text.value;
  }
  const source = byLocale[SOURCE_LOCALE];
  if (source === undefined) return { fault: `carries no ${SOURCE_LOCALE} text, the source every locale falls back to` };
  return { value: { source, byLocale } };
};

/** The text in the locale asked for, or the source's where that locale has none (FR-64; UX-97). */
export const servedIn = <Text>(input: { readonly localized: Localized<Text>; readonly locale: Locale }): Served<Text> => {
  const text = input.localized.byLocale[input.locale];
  return text === undefined
    ? { locale: SOURCE_LOCALE, text: input.localized.source, fellBack: true }
    : { locale: input.locale, text, fellBack: false };
};

/** The locales an item carries text in, in the registry's order — what the fallback queue may clear. */
export const translatedLocales = (localized: Localized<unknown>): Locale[] =>
  LOCALES.filter((locale) => localized.byLocale[locale] !== undefined);
