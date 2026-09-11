import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

/**
 * The root layout. There is deliberately no `src/app/layout.tsx` above this one: every path
 * outside `[locale]` is a Route Handler (`/health`, `/api/[...path]`), and Route Handlers need
 * no layout — so `<html>` belongs here, where the locale that fills its `lang` is known.
 */
type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * No page under this layout is prerendered — and this is an OPEN decision held open, not a
 * closed one. Whether `(public)` and `(identity)` may be un-forced is §14.2's own carve-out
 * question, which permits static rendering for "the marketing shell, the legal pages, the locale
 * bundles" and has never been applied to a specific route group.
 *
 * **The justification here was rewritten 28 Aug 2026, because the one it carried had expired.**
 * It argued NFR-85: wording is versioned configuration (FR-61, FR-62), so prerendering a page
 * with its strings would need a redeploy to change a sentence — the requirement inverted, and
 * invisibly so. That stopped being true when OQ-43 (19 Aug 2026) narrowed config-as-data to
 * behaviour rather than wording, and `src/server/messages.ts` implements the narrowing by
 * importing the catalogues as JSON. Labels are bundled at build time already; prerendering costs
 * nothing in freshness. Only help-centre articles and plan presentation copy stayed in the store,
 * and those surfaces are the public tier — tasks 74 … 77, unbuilt — which is the real reason the
 * question cannot be settled today rather than a reason to force dynamic rendering forever.
 *
 * What is NOT in question, and does not rest on this line: `(app)` declares its own
 * `force-dynamic` on §14.2's tenancy argument, the third leg of a rule whose other two are
 * `cacheComponents: false` and the ESLint ban on `"use cache"`. Deleting this changes nothing
 * there.
 *
 * One coupling to know before touching either: `setRequestLocale` is the PRECONDITION for static
 * rendering, and `src/i18n/page.ts` keeps those calls alive so this option stays open. With this
 * line present they are redundant; without it they are load-bearing. Deleting both is the one
 * combination that breaks, and it breaks quietly — every reader served the source locale.
 *
 * `generateStaticParams` still earns its place: it is how next-intl knows the locale set for
 * routing and alternate links.
 */
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The tab icon, the home-screen icon and the pinned-tab glyph, from the set the design delivered
 * on 11 Sep 2026 — `favicon/README.md` carries the geometry it was cut to: white on pine, the arc
 * locked at 266° from twelve o'clock, the mark at 60% of the tile, the corner radius at 25% of the
 * tile's width.
 *
 * **Declared here rather than as `app/icon.svg` and `app/apple-icon.png`, and the choice is forced
 * rather than stylistic.** Next 16.3.0 folds the filename convention into the head only when no
 * `icons` was configured at all — `resolve-metadata.js` guards that merge with
 * `if (!resolvedMetadata.icons)`. Safari's `mask-icon` has no filename convention and can reach the
 * head only through `icons.other`, so declaring it beside file-convention icons would have dropped
 * every one of them: no tab icon anywhere, no warning, and nothing a typecheck or a build could
 * see. It is one mechanism or the other, never both, and the documentation's "file-based metadata
 * has higher priority" describes the opposite of what the resolver does.
 *
 * `e2e/web/icons.spec.ts` asserts the emitted tags and fetches each href, so a link lost to that
 * guard fails a run rather than shipping.
 *
 * A page's `generateMetadata` returns `{ title }` alone (`src/i18n/page.ts`) and metadata merges
 * field by field, so every screen keeps this icon set.
 */
export const metadata: Metadata = {
  icons: {
    // The handoff's own head markup, in its order: the SVG for anything that takes one, then the
    // two raster fallbacks for anything that does not. 16 and 32 are a *different drawing* from
    // the SVG — the README calls them the tightened variant, a 9-unit band with the centre dot
    // closed up, because at those sizes the dot fills in and reads as a blot.
    //
    // `favicon-48.png` and `favicon-64.png` ship in `public/favicon/` undeclared, exactly as the
    // handoff declares them: a browser that understands the SVG needs no raster at those sizes,
    // and one that does not is asking for 16 or 32.
    icon: [
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon/favicon-32.png', sizes: '32x32' },
      { url: '/favicon/favicon-16.png', sizes: '16x16' },
    ],
    apple: '/favicon/apple-touch-icon.png',
    other: { rel: 'mask-icon', url: '/favicon/safari-pinned-tab.svg', color: '#2E6A4F' },
  },
};

/**
 * `theme_color`'s head half, colouring the browser chrome on Android and the title bar of an
 * installed window.
 *
 * **It belongs to `viewport` and not to `metadata`.** Next moved it, and a `themeColor` left on
 * `metadata` is not an error — it warns at build and emits nothing, which is the quiet half of
 * the same failure mode as the icons above. The value is `--pine-600`, restated because a
 * `<meta>` tag cannot read a custom property; `app/manifest.ts` holds the manifest's copy and
 * the two must move together.
 */
export const viewport: Viewport = { themeColor: '#2E6A4F' };

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // `[locale]` acts as a catch-all for unknown paths, so an unrecognised value is a 404 rather
  // than a reason to guess a language.
  if (!hasLocale(routing.locales, locale)) notFound();

  // Deprecated in favour of `next/root-params`, and called anyway: OQ-39 defers that migration
  // because root params are unsupported in Route Handlers AND Server Actions, which is how this
  // app reaches the API. next-intl keeps this API supported for exactly that reason. The call is
  // per-layout and per-page (`src/i18n/page.ts` says why it cannot be hoisted, and why
  // `force-dynamic` making it redundant today is not a licence to delete it).
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        {/*
          **One provider, at the root, with no props — task 99.**

          `NextIntlClientProvider` rendered from a Server Component inherits `locale`, `messages`,
          `formats`, `now` and `timeZone` from `i18n/request.ts`, so this needs no configuration and
          there is nowhere else in the app that mounts one. Every Client Component, in any route
          group, reads the catalogue its request already resolved.

          **It used to be `messages={null}` with fifteen scoped providers below it**, on the stated
          grounds that the default "ships EVERY message to the client … every B1-B11 field label,
          help text and validation message across three locales", against NFR-43. Both halves of
          that were false by the time it mattered. A request serves ONE locale, not three. And the
          B1-B11 labels are not in this catalogue at all — `packages/i18n/catalogues/disclosure/`
          holds them and OQ-58 closed 1 Sep 2026 by serving them through the API on the wizard's
          step read, "so no bundle carries any version's catalogue".

          What is actually here is `chrome`, `forms`, `identity` and `organization`: **14.4 KB
          gzipped** in Romanian, 17.2 KB in Russian. It is serialized in this LAYOUT's payload,
          which Next reuses across navigations inside it — where the per-page providers it replaces
          were re-sent on every navigation, each one duplicating a subset its parent had already
          shipped and narrowing its own subtree, because next-intl treats `messages` as atomic.

          `architecture.md` §12.5.6 carries the decision and what it cost to reach.
        */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
