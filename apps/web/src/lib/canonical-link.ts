import type { Locale } from '@easyesg/i18n';

/**
 * A page's self-referencing canonical, added to the `Link` header next-intl already emits — task 74.5
 * (`architecture.md` §10.8, amended 5 Oct 2026 by 182/119 and 23 Oct 2026 for its form).
 *
 * **Taken from the alternate whose `hreflang` is the page's own locale, never built here.** next-intl's
 * `alternateLinks` already resolves the forwarded host and protocol, drops the query and applies
 * `localePrefix: 'as-needed'` — the Romanian address unprefixed, the other two prefixed. A canonical assembled
 * beside it would be a second copy of those three rules, free to disagree with the alternates a crawler reads in
 * the same header; the alternate for the reader's own locale IS the page's address in that locale, so the
 * canonical is that entry again under `rel="canonical"`.
 *
 * **A header, not a `<link>` in the `<head>`.** The marketing home is prerendered (task 74.4), and an absolute
 * address in its markup would need the public origin at build time, which `apps/web` keeps a runtime input
 * (`src/lib/env.ts`); a relative one is what Google advises against. The proxy sees each request's host, as the
 * alternates do, so the canonical follows whichever host serves the page — OQ-31's host question stays open.
 *
 * `null` when the header carries no alternate for the locale — no header at all, which next-intl omits on its own
 * redirects — so the caller leaves the response as it was rather than writing a canonical it cannot ground.
 */
const ALTERNATE = /<([^>]*)>;\s*rel="alternate";\s*hreflang="([^"]+)"/g;

export function withCanonical({
  link,
  locale,
}: {
  readonly link: string | null;
  readonly locale: Locale;
}): string | null {
  if (!link) return null;
  for (const [, address, hreflang] of link.matchAll(ALTERNATE)) {
    if (hreflang === locale) return `${link}, <${address}>; rel="canonical"`;
  }
  return null;
}
