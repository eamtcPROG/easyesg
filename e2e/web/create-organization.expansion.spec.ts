import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  organizationIdsForAccount,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded } from './support/expansion';

/**
 * S-04 at +40% (UX-94, UX-73's three frames; task 30.2).
 *
 * **Its own file because it must run against the PADDED server**, and the only way to reach that
 * server is to be in the `expansion` project — whose `testMatch` was widened in this task from
 * `expansion.spec.ts` to every `*expansion*` spec. That widening is the finding, not a
 * convenience: S-28's frames (task 27.7) sit inside `credentials.spec.ts`, which the `identity`
 * project runs against the **unpadded** instance, so they assert that ordinary Romanian does not
 * overflow — a true statement, and not the one their name makes. They move here in the same
 * change.
 *
 * **Sign-in still works with the catalogue padded** because `expandString` *appends* `·` rather
 * than replacing, and Playwright's `getByLabel` matches on substring. That is worth knowing before
 * someone reaches for `{ exact: true }` in an authenticated expansion spec and cannot see why it
 * stops matching.
 *
 * This screen is where the check earns its place: four labelled fields with help text under each,
 * a select whose option is a country name, and a closing line above the action — inside
 * `FocusColumn`'s 560px measure, under a global tier carrying a full email address.
 */
const RUN_PREFIX = `e2e-web-found-x-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';

const founders: string[] = [];

test.afterAll(async () => {
  for (const email of founders) {
    await cleanupOrganizations(await organizationIdsForAccount(email));
  }
  await cleanupAccounts(RUN_PREFIX);
});

async function arriveAtCreateOrganization(page: Page, label: string): Promise<void> {
  const email = `${RUN_PREFIX}-${label}@example.md`;
  founders.push(email);

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/create-organization');
}

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`S-04 tolerates +40% at ${frame.width}`, async ({ page }) => {
    await arriveAtCreateOrganization(page, `x${frame.width}`);
    await page.setViewportSize(frame);
    await page.reload();

    // The padded catalogue actually arrived — without this the rest asserts nothing, which is
    // exactly what the frames in `credentials.spec.ts` were doing from the wrong project.
    await expect(page.getByText('·').first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The one primary action survived the expansion, at every frame.
    await expect(page.getByRole('button', { name: /Creați organizația/ })).toBeVisible();
  });
}
