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

  // Every route carries its locale, public and authenticated alike.
  //
  // This is a deliberate departure from how the same question is answered for TENANCY. UX-2
  // forbids the active organization from ever appearing in a URL segment — it is session
  // state, and a second source would make an org-switch race into a cross-tenant read. Language
  // is the opposite case: it is not a security boundary, and UX-4 requires every addressable
  // state to have a shareable address that restores it on load. A colleague sent a link to a
  // validation finding should see the page; which language they see it in is their own
  // preference, resolved from the cookie the session sets at sign-in.
  //
  // 'always' is next-intl's default; stated because it is a decision, not an inherited default.
  localePrefix: 'always',

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
