import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded } from './support/expansion';

/**
 * S-15 at +40% (UX-94, UX-73's three frames; task 30.3), in the `expansion` project so the
 * catalogue is actually padded — see `credentials.expansion.spec.ts` for why that project exists.
 *
 * **The screen with the most to lose from expansion so far.** Thirteen labelled fields, four of
 * them carrying help text, two selects whose options are full sentences (*Societate cu răspundere
 * limitată (SRL)*), an LEI label that is an expansion by design rather than an abbreviation, and a
 * save/discard pair sharing a row with a sentence about dirty state.
 */
const RUN_PREFIX = `e2e-web-profile-x-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';

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
  test(`S-15 tolerates +40% at ${frame.width}`, async ({ page }) => {
    await signedIn(page, `x${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto('/organization');

    await expect(page.getByText('·').first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await expect(page.getByRole('button', { name: /Salvați modificările/ })).toBeVisible();
  });
}
