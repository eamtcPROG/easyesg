import { LOCALES, type Locale } from '@easyesg/i18n';

/**
 * The locales as the object `ParseEnumPipe` admits, for a route that takes the language in its address — the preview's
 * `?locale=` (task 43) and the published content's (task 76). Derived from the registry, so a fourth locale needs no
 * edit here (NFR-25); one copy, because two routes deriving it each was the second copy of a vocabulary's operation.
 */
export const LOCALE_ENUM: Readonly<Record<Locale, Locale>> = Object.fromEntries(
  LOCALES.map((locale) => [locale, locale]),
) as Record<Locale, Locale>;
