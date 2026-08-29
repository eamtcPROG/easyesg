import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded } from './support/expansion';
import { PASSWORD } from './support/second-factor';

/**
 * S-28 at +40% (UX-94, UX-73's three frames) — **moved out of `credentials.spec.ts` on
 * 29 Aug 2026**, task 30.2, because it was in the wrong Playwright project to mean anything.
 *
 * Its own docblock said the assertion was "the padded catalogue actually arrived, the document
 * does not scroll sideways, and the primary action survived". Only one instance of the web server
 * runs with `EASYESG_PSEUDOLOCALE=1`, and the `identity` project points at the other one — so the
 * padded catalogue never arrived, that clause was never asserted, and what the three tests
 * actually checked was that ordinary Romanian does not overflow. True, useful, and not the claim
 * the test names.
 *
 * The `expansion` project's `testMatch` now takes every `*expansion*` spec rather than only the
 * file named for it, which is what makes an authenticated screen's check reachable at all.
 * `identity`'s `testIgnore: /expansion/` keeps the two sets disjoint.
 *
 * Sign-in works against the padded catalogue because `expandString` *appends* `·` and
 * `getByLabel` matches on substring.
 */
const RUN_PREFIX = `task27-x-${process.pid}-${Date.now()}`;

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string): Promise<void> {
  const email = `${RUN_PREFIX}-${label}@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`S-28 tolerates +40% at ${frame.width}`, async ({ page }) => {
    await signedIn(page, `x${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto('/account/credentials');

    // The clause the old location could never satisfy.
    await expect(page.getByText('·').first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await expect(page.getByRole('button', { name: /Schimbați parola/ })).toBeVisible();
  });
}
