import { defineRouting } from 'next-intl/routing';
import { LOCALES, SOURCE_LOCALE } from '@easyesg/i18n';

/**
 * Routing configuration. The locale set itself lives in `@easyesg/i18n` because `apps/admin`
 * and the export pipeline read the same list — NFR-25 requires a fourth locale to be addable
 * through content and configuration alone, and three copies of the array is how that stops
 * being true.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: SOURCE_LOCALE,

  // Every route carries its locale EXCEPT the source locale, which is served unprefixed.
  //
  // Language stays in the URL, and that is still a deliberate departure from how the same
  // question is answered for TENANCY. UX-2 forbids the active organization from ever appearing
  // in a URL segment — it is session state, and a second source would make an org-switch race
  // into a cross-tenant read. Language is the opposite case: it is not a security boundary, and
  // UX-4 requires every addressable state to have a shareable address that restores it on load.
  // A colleague sent a link to a validation finding should see the page; which language they
  // see it in is their own preference, resolved from the cookie the session sets at sign-in.
  //
  // **'as-needed' rather than next-intl's 'always' default — amended 21 Aug 2026** (product
  // owner, on SEO grounds; architecture.md §10.8 records it). Romanian is the source locale and
  // Moldova is the primary market, so `/` and `/register` are the canonical addresses and
  // `/ro/register` 307s onto them. What this buys is not a ranking rule — Google supports either
  // scheme with hreflang — but the root URL: it is the most linked, most typed and most crawled
  // address in the product, and under 'always' every hit on it paid a redirect hop before
  // rendering anything. EN and RU keep their prefixes, and `alternateLinks` emits the hreflang
  // set that tells a crawler the three are one page in three languages.
  //
  // Two consequences that are NOT free, both handled rather than inherited:
  //   - `src/proxy.ts` may no longer read the locale as path segment 1. Under this mode the
  //     default locale has no prefix, so `/home` would have parsed as "no route segment" and
  //     fallen through the auth boundary as public. It resolves the first NON-locale segment.
  //   - the matcher must detect unprefixed pathnames (next-intl's own warning for this mode).
  //     Ours already does; it excludes prefixes, not locales.
  localePrefix: 'as-needed',

  // The cookie is how a signed-in user's profile preference (S-27, FR-10) reaches the bare-path
  // redirect without special-casing it: the session sets NEXT_LOCALE at sign-in, and next-intl's
  // ordinary detection then does the right thing for authenticated and anonymous alike.
  localeCookie: { sameSite: 'lax' },

  // Anonymous visitors get Accept-Language negotiation on the public surface.
  localeDetection: true,

  // <link rel="alternate" hreflang> on the public surface. Harmless on authenticated routes,
  // which are noindex anyway.
  alternateLinks: true,
});
