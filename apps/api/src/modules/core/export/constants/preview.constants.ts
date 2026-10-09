import { LOCALES, type Locale } from '@easyesg/i18n';

/** The locales as the object `ParseEnumPipe` admits, derived from the registry so a fourth locale needs no edit here. */
export const PREVIEW_LOCALES: Readonly<Record<Locale, Locale>> = Object.fromEntries(
  LOCALES.map((locale) => [locale, locale]),
) as Record<Locale, Locale>;

/**
 * What the preview's markup may load — nothing but its own inline styles and the fonts and images inside it — so that
 * even markup that escaped React's escaping could run and fetch nothing. S-10's frame admits no script besides.
 */
export const PREVIEW_CONTENT_SECURITY_POLICY = "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:";
