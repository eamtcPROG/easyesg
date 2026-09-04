import type { Metadata } from 'next';

/**
 * Marketing home · unauthenticated
 *
 * No S-nn id: design_spec.md §4.4's inventory covers S-01…S-28 and stops at the authenticated
 * boundary, yet this surface ships from apps/web (IMPLEMENTATION_PLAN Phase 10). Logged as an
 * open question — UX-7's coverage contract does not reach it.
 *
 * Reference: `design/screens/EasyESG Public Home.dc.html`.
 *
 * Not built. `design_spec.md` §5 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in `design/screens/` are
 * the rendered reference — read them for values, never copy their markup (OQ-10).
 *
 * **The body is still `null`; only the title is here (task 74.1).** The `(public)` chrome made this
 * address something a person lands on, and an untitled document is a WCAG 2.4.2 (Page Titled)
 * failure at Level A — `e2e/web/accessibility.spec.ts` found it the moment `/` entered the scan.
 */

/**
 * **The product's own name, and deliberately nothing more.**
 *
 * It is written here rather than through `localizedPageTitle` because that helper resolves a
 * catalogue `title` leaf, and this string is not catalogue text: the wordmark is *identity, not
 * copy*, identical in every locale, and `BrandMark` already records that no catalogue owns it.
 * `localizedPageTitle`'s own docblock names writing your own `generateMetadata` as the escape for
 * a title the helper cannot express.
 *
 * A fuller title — the tagline, the `hreflang` and canonical pair that should sit beside it — is
 * **task 74.5's**, which is an explicit unknown: `localePrefix: 'as-needed'` serves Romanian
 * unprefixed and no NFR governs how three locales are addressed to a search engine, and its row
 * requires the decision written into the artefact that owns it *before* any `<head>` is authored.
 * Authoring one here would close that in passing. This discharges the Level A failure and reaches
 * for nothing 74.3 or 74.5 owns.
 */
export const metadata: Metadata = { title: 'easyESG' };

export default function MarketingHomePage() {
  return null;
}
