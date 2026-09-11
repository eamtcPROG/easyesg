import type { MetadataRoute } from 'next';

/**
 * The web app manifest, from the favicon set's `site.webmanifest` (design handoff, 11 Sep 2026).
 *
 * It is a **file convention**, not a static asset: Next serves this at `/manifest.webmanifest`
 * and injects `<link rel="manifest">` into every page's head on its own. Nothing links it by
 * hand, and the design's own `site.webmanifest` is deliberately not copied into `public/` —
 * two manifests at two addresses is the second source of truth this repo spends its gates
 * preventing.
 *
 * **It sits at `app/` rather than under `[locale]/` because nothing here is localized.** The
 * one field that would be — `description` — is left out rather than shipped in one language:
 * a sentence read by a person belongs in a catalogue (FR-61, FR-62), and a manifest route has
 * no request locale to resolve one against. `name` is the product's proper name, which
 * `packages/ui`'s `BrandMark` already establishes as identity rather than copy.
 *
 * **The two colours are tier-1 token values, restated here because a manifest is JSON and
 * cannot read CSS.** `#2E6A4F` is `--pine-600`, the single accent; `#F4F6F8` is `--slate-50`,
 * which `--surface-sunken` resolves to — the page ground, so the splash screen matches the app
 * behind it. If either token moves, this file is the copy that will not notice.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EasyESG',
    short_name: 'EasyESG',

    // `localePrefix: 'as-needed'` makes `/` the canonical Romanian root with no redirect hop
    // (`src/i18n/routing.ts`), so an installed app opens on a real page rather than a 307.
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F6F8',
    theme_color: '#2E6A4F',
    icons: [
      { src: '/favicon/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/favicon/icon-512.png', sizes: '512x512', type: 'image/png' },

      // Android crops an icon to whatever shape the launcher uses. The maskable variant draws
      // the mark at 44% instead of 60% so the circle crop cannot clip it; without `purpose`
      // declared, the launcher would crop the ordinary icon and cut the ring.
      { src: '/favicon/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
