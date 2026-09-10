import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, verificationTokenFor } from './support/db';

/**
 * §8.1's two address states in a real browser (task 103; `design_spec.md` §4.5).
 *
 * **What only a browser can prove here is that the address answers at all.** Every one of these
 * routes returned HTTP 200 with an empty `<main>` before this task — no heading, no text, no
 * control — which is indistinguishable from a working page to every other gate in the set: the
 * files compiled, the types checked, and `return null` is valid React. A unit spec over the
 * component would assert the component, not the sixteen pages that have to render it.
 *
 * The 404 half carries a second claim the others cannot: that Next's own unstyled default is
 * **gone**. Asserting our heading is present would still pass if the framework page were served
 * alongside it, so the absence of `This page could not be found` is asserted explicitly.
 */
const RUN_PREFIX = `e2e-web-address-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';

const NOT_YET_AVAILABLE = 'Această parte nu este încă disponibilă';
const NOT_FOUND = 'Această adresă nu există';

/** Reachable with no session — `(public)`, per `lib/route-access.ts`'s unauthenticated segments. */
const PUBLIC_ADDRESSES = [
  '/',
  '/help',
  '/help/contact',
  '/help/oarecare-articol',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
] as const;

/** `(app)/(workspace)` — the proxy bounces these to sign-in without a session, so they need one. */
const WORKSPACE_ADDRESSES = [
  '/account',
  '/notifications',
  '/billing',
  '/billing/plans',
  '/billing/subscription',
  '/billing/invoices',
  '/billing/payment-methods',
  '/billing/account',
  '/billing/enterprise',
  '/billing/orders/0195c0de-0000-7000-8000-000000000000',
  '/billing/orders/0195c0de-0000-7000-8000-000000000000/return',
] as const;

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string): Promise<void> {
  const email = `${RUN_PREFIX}-${label}@example.md`;
  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  // The post-sign-in branch must settle before any `goto`, or the request races the session
  // cookie and the closed-by-default gate correctly bounces it.
  await page.waitForURL('**/home');
}

test.describe('error — not yet available', () => {
  for (const address of PUBLIC_ADDRESSES) {
    test(`${address} answers a heading and a way out, signed out`, async ({ page }) => {
      await page.goto(address);
      await expect(page.getByRole('heading', { name: NOT_YET_AVAILABLE })).toBeVisible();
      // Signed out, the only destination that renders is the one that hands out a session.
      await expect(page.getByRole('link', { name: 'Mergeți la autentificare' })).toBeVisible();
    });
  }

  test('every workspace address answers, signed in', async ({ page }) => {
    await signedIn(page, 'workspace');
    for (const address of WORKSPACE_ADDRESSES) {
      await page.goto(address);
      await expect(page.getByRole('heading', { name: NOT_YET_AVAILABLE })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Înapoi la pagina principală' })).toBeVisible();
    }
  });
});

test.describe('error — not found', () => {
  test('an unmatched address renders the localized surface, not the framework default', async ({
    page,
  }) => {
    const response = await page.goto('/sign-in/adresa-inexistenta');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mergeți la autentificare' })).toBeVisible();
    // Next's built-in page, which this route served until task 103. Asserting only that our
    // heading is present would pass with the framework default rendered beside it.
    await expect(page.getByText('This page could not be found')).toHaveCount(0);
  });

  test('an unknown address under an authenticated segment is bounced, not 404ed', async ({
    page,
  }) => {
    await page.goto('/nonsense');

    // `proxy.ts`'s closed-by-default gate runs BEFORE routing, so an address needing a session
    // never reaches the catch-all while signed out. Asserted because it is the surprising half of
    // the pair and nothing else states it: the 404 surface is reachable signed out only under
    // `route-access.ts`'s unauthenticated segments, which is why the test above uses `/sign-in/…`.
    await expect(page).toHaveURL(/\/sign-in\?return=%2Fnonsense$/);
  });

  test('the same address answers the 404 surface once a session exists', async ({ page }) => {
    await signedIn(page, 'notfound');

    const response = await page.goto('/nonsense');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
  });
});
