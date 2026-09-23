import { expect, test } from '@playwright/test';

/**
 * The tab icon, and the one guard that can see it go.
 *
 * **This exists because the failure it guards is silent.** Next 16.3.0 folds its filename
 * convention into the head only when no `icons` was configured — `resolve-metadata.js` guards the
 * merge with `if (!resolvedMetadata.icons)` — and `mask-icon` can only be declared through
 * `icons.other`. The two mechanisms cancel rather than compose, and when they do, the build
 * succeeds, the types check, the page renders, and there is no icon. Nothing else in the gate set
 * reads the emitted head.
 *
 * So the assertions are on the DOCUMENT, never on the metadata object: a spec that imported
 * `metadata` from the layout and compared it to the same literals would restate the source and
 * pass in exactly the case this file was written for.
 *
 * Each href is then fetched, because a link tag pointing at a file that is not in `public/` is the
 * other half of the same defect — and `apps/web`'s standalone Dockerfile copies `public/` as a
 * separate line, so "declared" and "shipped" are genuinely two claims.
 */
const ICON_LINKS = [
  { rel: 'icon', href: '/favicon/favicon.svg', type: 'image/svg+xml' },
  { rel: 'icon', href: '/favicon/favicon-32.png', sizes: '32x32' },
  { rel: 'icon', href: '/favicon/favicon-16.png', sizes: '16x16' },
  { rel: 'apple-touch-icon', href: '/favicon/apple-touch-icon.png' },
  { rel: 'mask-icon', href: '/favicon/safari-pinned-tab.svg', color: '#2E6A4F' },
] as const;

/**
 * The shape this spec reads out of the manifest. Declared here rather than imported from
 * `next`: `request.json()` answers `any`, and a type taken from the source would make the
 * assertions agree with the implementation by construction instead of with the design.
 */
type ManifestDocument = {
  name: string;
  start_url: string;
  theme_color: string;
  background_color: string;
  icons: readonly { src: string; sizes: string; purpose?: string }[];
};

/** The three the manifest names, which no `<link>` mentions and only an install would fetch. */
const MANIFEST_ICONS = [
  { src: '/favicon/icon-192.png', sizes: '192x192', purpose: undefined },
  { src: '/favicon/icon-512.png', sizes: '512x512', purpose: undefined },
  { src: '/favicon/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
] as const;

test.describe('the head declares the favicon set', () => {
  test('every link the design specifies is emitted, with its attributes', async ({ page }) => {
    await page.goto('/');

    for (const { rel, href, ...attributes } of ICON_LINKS) {
      const link = page.locator(`link[rel="${rel}"][href="${href}"]`);
      await expect(link, `${rel} ${href} should be in the head`).toHaveCount(1);

      for (const [name, value] of Object.entries(attributes)) {
        await expect(link).toHaveAttribute(name, value);
      }
    }
  });

  test('no icon link points at anything else', async ({ page }) => {
    await page.goto('/');

    // An exact count, not `toBeGreaterThan`. A stray second `rel="icon"` — a leftover
    // `app/icon.svg`, a second declaration added to a route group — is a real finding, and a
    // loose assertion is how the duplicate-locator habit this repository has already paid for
    // gets written in the first place.
    const declared = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]').all();
    expect(declared).toHaveLength(ICON_LINKS.length);
  });

  test('the theme colour reaches the head from `viewport`, not `metadata`', async ({ page }) => {
    await page.goto('/');

    // `themeColor` left on `metadata` warns at build and emits nothing — the quiet variant of
    // the icons trap, and the reason this is asserted rather than assumed.
    // One per scheme since task 152 (UX-80): the chrome follows `prefers-color-scheme`, `--accent` as each resolves it.
    // An exact count, so a third copy or a lost pair is a failure rather than a match on the first.
    const themeColors = page.locator('meta[name="theme-color"]');
    await expect(themeColors).toHaveCount(2);
    await expect(themeColors.and(page.locator('[media="(prefers-color-scheme: light)"]'))).toHaveAttribute(
      'content',
      '#2E6A4F',
    );
    await expect(themeColors.and(page.locator('[media="(prefers-color-scheme: dark)"]'))).toHaveAttribute(
      'content',
      '#58B085',
    );
  });
});

test.describe('every declared file is actually served', () => {
  test('each icon href fetches', async ({ request }) => {
    for (const { href } of ICON_LINKS) {
      const response = await request.get(href);
      expect(response.status(), `${href} should be served`).toBe(200);
    }
  });

  test('the manifest is linked, parses, and its icons fetch', async ({ page, request }) => {
    await page.goto('/');

    // Next emits this link from `app/manifest.ts` unprompted — no `<link rel="manifest">` is
    // written anywhere in the source, which is precisely why it is worth asserting.
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href, 'Next should emit the manifest link from app/manifest.ts').not.toBeNull();

    const manifest = (await (await request.get(String(href))).json()) as ManifestDocument;
    expect(manifest.name).toBe('EasyESG');
    expect(manifest.start_url).toBe('/');
    expect(manifest.theme_color).toBe('#2E6A4F');
    expect(manifest.background_color).toBe('#F4F6F8');

    expect(manifest.icons).toHaveLength(MANIFEST_ICONS.length);
    for (const [index, expected] of MANIFEST_ICONS.entries()) {
      expect(manifest.icons[index].src).toBe(expected.src);
      expect(manifest.icons[index].sizes).toBe(expected.sizes);
      expect(manifest.icons[index].purpose).toBe(expected.purpose);
      expect((await request.get(expected.src)).status(), `${expected.src} should be served`).toBe(200);
    }
  });
});
