import Negotiator from 'negotiator';
import { LOCALES, SOURCE_LOCALE, type Locale } from '@easyesg/i18n';

/**
 * RFC 9110's wildcard language range. Named rather than compared as a bare literal (CLAUDE.md,
 * "Conventions") — it is a one-member vocabulary belonging to the HTTP spec rather than to this
 * platform, and a name is what says which of the two it is at the comparison below.
 */
const ANY_LANGUAGE_TAG = '*';

/**
 * Resolves the response locale from an `Accept-Language` header (architecture.md OQ-46).
 *
 * **The API resolves wording server-side**, so this decides the language of every problem+json
 * `title`/`detail` and every envelope message. Both front ends are ordinary clients of one
 * public API (DR-11, AD-9), so this is also the contract a third-party integrator codes against.
 *
 * `Accept-Language` is named nowhere in the seven documents — OQ-46 is where the contract was
 * decided, and this file is its implementation. Three properties are load-bearing:
 *
 * - **The caller's header wins, and `apps/web` must send one.** OQ-32 makes the URL authoritative
 *   for rendering, so a page at `/ru` whose errors arrive in Romanian is the failure this must
 *   not produce. Web's server tier forwards its active locale; the console sends `ro` (OQ-42).
 * - **`q=0` means "not acceptable"**, not "lowest preference". A hand-rolled sort would quietly
 *   serve a locale the caller explicitly refused.
 * - **Region subtags fold to their language.** `ro-MD` and `ro-RO` are both `ro`: the platform
 *   ships one Romanian, and a Moldovan browser sending `ro-MD` must not fall through to source
 *   by accident — which, since Romanian *is* source, would look identical and hide the bug.
 *
 * Parsing is delegated rather than written here because q-values, wildcards and `q=0` are the
 * kind of detail that looks trivial and is not.
 */
export function negotiateLocale(acceptLanguage: string | undefined): Locale {
  if (!acceptLanguage) return SOURCE_LOCALE;

  // Negotiator wants a request-shaped object; it reads nothing else off it.
  const preferred = new Negotiator({ headers: { 'accept-language': acceptLanguage } }).languages();

  for (const tag of preferred) {
    // `*` means "anything acceptable". The source locale is the platform's answer to that.
    if (tag === ANY_LANGUAGE_TAG) return SOURCE_LOCALE;

    const language = tag.split('-')[0]?.toLowerCase();
    const match = LOCALES.find((supported: Locale) => supported === language);
    if (match) return match;
  }

  return SOURCE_LOCALE;
}
