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
 * S-37 at +40% (UX-94, UX-73's three frames; task 83.3), in the `expansion` project, whose server pads every
 * catalogue string. Its rows are buttons holding an organization's name over a role, which is the anatomy
 * padding stresses: a row that could not wrap would push the column sideways at 390.
 *
 * Sign-in works against the padded catalogue for `credentials.expansion.spec.ts`'s reason — `expandString`
 * appends, and a label or role name matches on substring.
 */
const RUN_PREFIX = `task83-x-${process.pid}-${Date.now()}`;

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function awaitingAChoice(page: Page, label: string): Promise<void> {
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

  organizations.push(
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label} Alfa`, role: 'editor' }),
  );
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label} Beta` }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/choose-organization');
}

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`S-37 tolerates +40% at ${frame.width}`, async ({ page }) => {
    await awaitingAChoice(page, `x${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto('/choose-organization');

    // Held to S-37's own heading, padded, rather than to whatever padded string the page shows first.
    await expect(
      page.getByRole('heading', { level: 1, name: exactlyPadded('Alegeți organizația') }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Both choices survive the padding, and each is still the whole row.
    const choices = page.getByRole('main').getByRole('button');
    await expect(choices).toHaveCount(2);
    for (const choice of await choices.all()) await expect(choice).toBeVisible();
  });
}
