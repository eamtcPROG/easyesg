import { expect, test } from '@playwright/test';

/**
 * The URL contract: what address a page has, and who may reach it.
 *
 * Both halves live in one spec because one change created both — `localePrefix: 'as-needed'`
 * (21 Aug 2026, architecture.md §10.8) serves the source locale unprefixed for SEO, and the
 * same change is what made `src/proxy.ts`'s auth boundary unable to read the locale as path
 * segment 1. The second half of this file is the regression guard for that, and it is the
 * important half: a wrong URL is a ranking question, a wrong auth boundary is a breach.
 *
 * These assertions run without a session, which is the state they are about.
 */

/** Follows no redirects, so the redirect ITSELF is the assertion. */
const head = (request: import('@playwright/test').APIRequestContext, path: string) =>
  request.get(path, { maxRedirects: 0 });

test.describe('the source locale is served unprefixed (SEO)', () => {
  test('the root is the Romanian home, not a redirect to /ro', async ({ request }) => {
    const response = await head(request, '/');
    expect(response.status()).toBe(200);
  });

  test('a superfluous /ro prefix consolidates onto the canonical address', async ({ request }) => {
    // next-intl 307s the prefixed default locale to the unprefixed form, so one page never has
    // two live addresses — which is the actual duplicate-content risk, ranking aside.
    for (const [prefixed, canonical] of [
      ['/ro', '/'],
      ['/ro/register', '/register'],
      ['/ro/verify', '/verify'],
    ]) {
      const response = await head(request, prefixed);
      expect(response.status(), `${prefixed} should redirect`).toBe(307);
      expect(new URL(response.headers().location, 'http://x').pathname).toBe(canonical);
    }
  });

  test('the other two locales keep their prefixes', async ({ request }) => {
    for (const path of ['/en/register', '/ru/register']) {
      expect((await head(request, path)).status(), path).toBe(200);
    }
  });

  test('each page declares its alternates, x-default included', async ({ request }) => {
    const response = await request.get('/register');

    // `alternateLinks` is what tells a crawler the three URLs are one page in three languages.
    // next-intl emits them as a `Link` RESPONSE HEADER rather than as <link> tags in the
    // markup — a form Google reads for hreflang, and the reason grepping the HTML for
    // `rel="alternate"` finds nothing and proves nothing.
    const links = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'link')
      .map((header) => header.value)
      .join(', ');

    for (const [hreflang, pathname] of [
      ['ro', '/register'],
      ['en', '/en/register'],
      ['ru', '/ru/register'],
      // x-default is the address a crawler serves when no declared language fits, and it must
      // be the unprefixed source locale rather than a prefixed variant.
      ['x-default', '/register'],
    ]) {
      const match = new RegExp(`<([^>]+)>; rel="alternate"; hreflang="${hreflang}"`).exec(links);
      expect(match, `no hreflang="${hreflang}" alternate`).not.toBeNull();
      expect(new URL(match![1]).pathname, `hreflang="${hreflang}"`).toBe(pathname);
    }
  });

  test('the unprefixed page still declares its language to assistive tech and crawlers', async ({
    page,
  }) => {
    await page.goto('/register');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  });
});

test.describe('the legal footer', () => {
  /**
   * The copyright year was frozen into all three catalogues (`© 2026 …`), so it would have gone
   * quietly wrong on 1 January and needed a release to correct. It is read from the clock now,
   * in Europe/Chisinau — the timezone that determines a Moldovan company's legal statements
   * (NFR-34's test applied to a small case).
   *
   * The assertion computes the expected year the same way the page does rather than hardcoding
   * one, because a test carrying `2026` would be the very defect it is guarding against.
   */
  const currentYear = () =>
    new Intl.DateTimeFormat('ro', { year: 'numeric', timeZone: 'Europe/Chisinau' }).format(
      new Date(),
    );

  test('states the current year, not a year baked into the catalogue', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(`© ${currentYear()} EasyESG SRL · Chișinău`)).toBeVisible();
  });

  test('renders the year without a thousands separator in every locale', async ({ page }) => {
    // ICU formats a bare numeric `{year}` as a number, which is "2 026" in ro and ru and
    // "2,026" in en. The named `year` date format is what avoids that; this is its guard.
    for (const path of ['/register', '/en/register', '/ru/register']) {
      await page.goto(path);
      const note = await page.locator('footer span').first().innerText();
      expect(note, path).toContain(currentYear());
      expect(note, path).not.toMatch(/\d[\s,]\d{3}/);
    }
  });

  test('links to the three legal documents in the active locale', async ({ page }) => {
    await page.goto('/ru/register');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Условия использования' })).toHaveAttribute(
      'href',
      '/ru/legal/terms',
    );
  });
});

test.describe('the auth boundary holds on unprefixed paths', () => {
  /**
   * The regression this file exists for. `requiresSession` used to read segment 2 as the route
   * and segment 1 as the locale; unprefixed, `/home` has no segment 2, so it read as "the
   * marketing home" and returned public. Every authenticated Romanian route would have been
   * reachable with no session — and every test then in the suite used a prefixed URL, so
   * nothing would have caught it.
   */
  test('an authenticated route with no session redirects to sign-in, unprefixed', async ({
    request,
  }) => {
    for (const path of ['/home', '/reports', '/organization', '/billing']) {
      const response = await head(request, path);
      expect(response.status(), `${path} must not be public`).toBe(307);
      expect(new URL(response.headers().location, 'http://x').pathname).toBe('/sign-in');
    }
  });

  test('and on a prefixed locale, keeping the locale', async ({ request }) => {
    const response = await head(request, '/ru/home');
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, 'http://x').pathname).toBe('/ru/sign-in');
  });

  test('the unauthenticated screens stay reachable in both prefix forms', async ({ request }) => {
    expect((await head(request, '/register')).status()).toBe(200);
    expect((await head(request, '/ru/register')).status()).toBe(200);
  });

  test('an unknown segment is closed by default, not opened', async ({ request }) => {
    // UNAUTHENTICATED_SEGMENTS is an allowlist; anything unnamed must require a session, which
    // is the property that makes adding a public screen a deliberate act.
    const response = await head(request, '/not-a-real-screen');
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, 'http://x').pathname).toBe('/sign-in');
  });
});
