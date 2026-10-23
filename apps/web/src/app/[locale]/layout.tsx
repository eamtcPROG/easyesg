import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';
import { RESTATED_TOKEN } from '@/lib/restated-tokens';
import { PageSkipLink } from '@/shared/page-skip-link';

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
 * **This layout forces nothing, so the groups below it decide — task 74.4** (`architecture.md` §14.2, amended 23 Oct
 * 2026; §12.5.6's task-74 row (3)). Until then a `force-dynamic` here kept every page dynamic, an open question held
 * open: §14.2 permits static rendering for the marketing shell and nothing else, and no route group had been given it.
 * The answer is the public zone, by static rendering rather than `"use cache"`, which needs the application-wide Cache
 * Components flag §14.2 keeps off. So `force-dynamic` now sits on every segment beneath this one that is NOT the public
 * zone — `(app)`'s layout, `(identity)`'s, the catch-all `[...rest]` — and on the legal document page, which reads
 * A-21's operator per request; the marketing home is prerendered and revalidated. `e2e/web/static-rendering.spec.ts`
 * reads the built manifest and fails on a prerendered page anywhere else.
 *
 * **`setRequestLocale` is now load-bearing, not redundant**: it is the precondition for static rendering, and
 * `src/i18n/page.ts` keeps the per-page call. Deleting it would serve the prerendered home in the source locale at
 * every address, with no error anywhere.
 *
 * `generateStaticParams` is what prerenders the home once per locale, and how next-intl knows the locale set for
 * routing and alternate links.
 */
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
 * the same failure mode as the icons above. The value is `--accent`, restated because a
 * `<meta>` tag cannot read a custom property — **in each scheme** since task 152 (UX-80): `--pine-600`
 * in light and `--pine-dark-400` in dark, so a dark-preferring device's chrome matches the dark app
 * behind it. `app/manifest.ts` holds the manifest's copy, which cannot follow the scheme, and the
 * light pair must move with it.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: RESTATED_TOKEN.ACCENT_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: RESTATED_TOKEN.ACCENT_DARK },
  ],
};

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
      {/* The `body` type role as a class, like every other surface's role (task 152): `.t-body` is its
          one authored copy, where `globals.css` used to restate its literals. */}
      <body className="t-body">
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
        <PageSkipLink locale={locale} />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
