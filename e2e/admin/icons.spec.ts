import { expect, test } from '@playwright/test';

/**
 * The console's half of the favicon set — the same assets, declared the other way.
 *
 * `apps/web` declares icons through `metadata.icons` because Next resolves them; Vite resolves
 * nothing, so `apps/admin/index.html` writes the tags by hand and `public/` is copied to `dist/`
 * verbatim. Two mechanisms, one design, and **neither app's guard can see the other's break** —
 * which is the reason this file exists beside `e2e/web/icons.spec.ts` rather than being folded
 * into it.
 *
 * It runs cross-origin against the built bundle, like the rest of the `admin` project, so what is
 * asserted is what Caddy serves out of `dist/` and not what sits in the source tree.
 *
 * Signed out is deliberate: the icons are chrome, not console content, and `_realm`'s guard sends
 * an unauthenticated visitor to sign-in — a page that must carry the icon like any other.
 */
const ICON_LINKS = [
  { rel: 'icon', href: '/favicon/favicon.svg', type: 'image/svg+xml' },
  { rel: 'icon', href: '/favicon/favicon-32.png', sizes: '32x32' },
  { rel: 'icon', href: '/favicon/favicon-16.png', sizes: '16x16' },
  { rel: 'apple-touch-icon', href: '/favicon/apple-touch-icon.png' },
  { rel: 'mask-icon', href: '/favicon/safari-pinned-tab.svg', color: '#2E6A4F' },
] as const;

test('the console declares the favicon set and serves every file', async ({ page, request }) => {
  await page.goto('/');

  for (const { rel, href, ...attributes } of ICON_LINKS) {
    const link = page.locator(`link[rel="${rel}"][href="${href}"]`);
    await expect(link, `${rel} ${href} should be in the head`).toHaveCount(1);

    for (const [name, value] of Object.entries(attributes)) {
      await expect(link).toHaveAttribute(name, value);
    }

    expect((await request.get(href)).status(), `${href} should be served from dist/`).toBe(200);
  }

  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#2E6A4F');
});

test('the console ships no manifest, and none of the icons an install would want', async ({ page, request }) => {
  await page.goto('/');

  // **An absence is only evidence once the page is known to have loaded.** Every assertion below
  // is a `toHaveCount(0)` or a `not.toContain`, and all three would pass just as happily against
  // a blank document or a 500 — so the head is proved present first, and the absences mean
  // something only after it is.
  await expect(page.locator('link[rel="icon"][href="/favicon/favicon.svg"]')).toHaveCount(1);

  // Not an omission — a decision, recorded in `index.html`: the console is IP-allowlisted
  // (§10.2), behind mandatory MFA (NFR-65) and `noindex`, so it is never installed to a home
  // screen and the 192/512 PNGs would be unreachable bytes in the bundle. Asserting the absence
  // is what stops a later "copy the whole handoff folder to both apps" from undoing it quietly.
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);

  for (const absent of ['/favicon/icon-192.png', '/favicon/icon-512.png', '/favicon/icon-maskable-512.png']) {
    // Caddy's SPA rewrite answers any unknown path with `index.html` at 200, so a 404 is not
    // what a missing file looks like here. The content type is: an icon that were present would
    // be served as `image/png`.
    const response = await request.get(absent);
    expect(response.status(), `${absent} should reach the SPA fallback, not fail to connect`).toBe(200);
    expect(response.headers()['content-type'], `${absent} should not be in the bundle`).not.toContain('image/');
  }
});
