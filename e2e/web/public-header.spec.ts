import { expect, test } from '@playwright/test';

/**
 * The `(public)` chrome band in a real browser (task 74.1's header half).
 *
 * **What only a browser can prove here is that the band is PAINTED as a band.** Its structure —
 * brand, actions, three locales — is cheap to assert anywhere; what nothing else could see is
 * whether `tone="band"` reached the class list. It did not, on the first build, and the way it
 * failed is the reason this file exists: `BUTTON_TONE` was exported from a module carrying
 * `'use client'`, so the Server Component reading it got `undefined` rather than a throw, the class
 * was dropped by a `.filter(Boolean)`, and the call to action rendered `--accent` on
 * `--globalbar-surface` — pine on pine at about 1.4:1. `pnpm typecheck` was green and right to be:
 * TypeScript resolves the import against the source module, where the value is real. `pnpm lint`,
 * `pnpm build` and every other gate agreed. Only the computed style disagreed.
 *
 * So the assertion is on the **computed** background, against the token the band pairing is
 * declared in, and against `--accent` explicitly — the two must not be the same colour. Asserting a
 * hex literal instead would fail on the next re-skin, which UX-79 says should cost a tier 1 edit
 * and nothing else; asserting only "not accent" would pass on any wrong colour at all.
 *
 * No session and no database. These screens carry none (`design_spec.md` §5.1b), which is what
 * makes this the cheapest spec in the suite.
 */

/** Resolve a custom property the way the browser paints it, not as the declared `var(...)` text. */
async function paintedColour(
  page: import('@playwright/test').Page,
  property: string,
): Promise<string> {
  return page.evaluate((token) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = `var(${token})`;
    document.body.append(probe);
    const painted = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return painted;
  }, property);
}

test('the band names itself, and its links resolve', async ({ page }) => {
  await page.goto('/');

  const banner = page.getByRole('banner', { name: 'Antetul site-ului' });
  await expect(banner).toBeVisible();

  // Exact counts, not `.first()`: a duplicate here is the defect, not a locator inconvenience
  // (root CLAUDE.md — "a test that works around an ambiguity is that ambiguity's only record").
  await expect(banner.getByRole('link', { name: 'Autentificare' })).toHaveCount(1);
  await expect(banner.getByRole('link', { name: 'Creați un cont' })).toHaveCount(1);
  await expect(banner.getByRole('link', { name: 'easyesg — prima pagină' })).toHaveCount(1);

  await banner.getByRole('link', { name: 'Autentificare' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('the call to action is painted against the band, not with the accent', async ({ page }) => {
  await page.goto('/');

  const cta = page.getByRole('banner').getByRole('link', { name: 'Creați un cont' });
  const painted = await cta.evaluate((node) => getComputedStyle(node).backgroundColor);

  expect(painted).toBe(await paintedColour(page, '--button-band-surface'));
  // The failure this file was written for: `--accent` is `--pine-600`, the band `--pine-800`.
  expect(painted).not.toBe(await paintedColour(page, '--accent'));
});

test.describe('three locales', () => {
  const FRAMES = [
    { path: '/', banner: 'Antetul site-ului', signIn: 'Autentificare', href: '/sign-in' },
    { path: '/en', banner: 'Site header', signIn: 'Sign in', href: '/en/sign-in' },
    { path: '/ru', banner: 'Шапка сайта', signIn: 'Вход', href: '/ru/sign-in' },
  ];

  for (const frame of FRAMES) {
    test(`the band is localized at ${frame.path}`, async ({ page }) => {
      await page.goto(frame.path);

      const banner = page.getByRole('banner', { name: frame.banner });
      await expect(banner).toBeVisible();
      // The href carries the locale prefix — or, for the source locale, deliberately does not
      // (`localePrefix: 'as-needed'`, architecture.md §10.8). A hand-built `/${locale}${path}` is
      // wrong in exactly one of the three cases, which is why `@/i18n/navigation` builds them.
      await expect(banner.getByRole('link', { name: frame.signIn })).toHaveAttribute(
        'href',
        frame.href,
      );
    });
  }
});

/**
 * UX-73's narrowest frame. The first build overflowed it by about 110px — brand, language, sign-in
 * and the call to action measure roughly 480px against 375 — and the overflow was invisible in
 * every other check, including the desktop runs of the tests above.
 */
test('the band does not overflow the 390 frame', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBe(clientWidth);
});
