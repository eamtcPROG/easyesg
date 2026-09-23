import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, verificationTokenFor } from './support/db';
import { exactlyPadded } from './support/expansion';
import { PASSWORD } from './support/second-factor';

/**
 * S-27 at +40% (task 52.3; UX-94, UX-73's three frames): the record's three sections and its save, padded, with nothing
 * scrolling sideways. The category names are the api's words and arrive padded too, from the padded api the browser
 * suite runs beside this server (task 51.3). In the `expansion` project for `credentials.expansion.spec.ts`'s recorded
 * reason: only that server runs with `EASYESG_PSEUDOLOCALE=1`.
 */
const RUN_PREFIX = `task52-3-x-${process.pid}-${Date.now()}`;
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

/** S-28's padded journey's sign-in: a plain label matches its padded text, and only `Parolă` needs to be exact. */
async function signedIn(page: Page, label: string): Promise<void> {
  const email = `${RUN_PREFIX}-${label}@example.md`;
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
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

for (const frame of FRAMES) {
  test(`S-27 holds its padded copy at ${frame.width}px`, async ({ page }) => {
    await signedIn(page, `f${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto('/account');

    await expect(page.getByRole('heading', { level: 1, name: exactlyPadded('Profil și preferințe') })).toBeVisible();
    await expect(page.getByRole('region', { name: exactlyPadded('Limbi') })).toBeVisible();
    await expect(page.getByRole('group', { name: exactlyPadded('Mementouri') })).toBeVisible();
    await expect(page.getByRole('button', { name: exactlyPadded('Salvați modificările') })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
