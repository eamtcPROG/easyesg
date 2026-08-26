import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, verificationTokenFor } from './support/db';

/**
 * The automated half of NFR-75's verification (architecture.md §12.1 pins @axe-core/playwright
 * for exactly this), on the first real screens. WCAG 2.2 AA is the target; axe automates the
 * machine-checkable part and the manual keyboard/screen-reader audit remains the other half.
 *
 * All three locales on the register screen: the axe pass is mostly locale-independent, but
 * `lang` correctness and accessible names are precisely what varies.
 */
const SCREENS = ['/register', '/en/register', '/ru/register', '/verify'];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const scan = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
};

for (const screen of SCREENS) {
  test(`axe finds no violations on ${screen}`, async ({ page }) => {
    await page.goto(screen);
    await scan(page);
  });
}

/**
 * S-16, which is a different kind of screen and therefore a different kind of scan (task 26.4).
 *
 * Every screen above is a Focus form: labels, a summary, one primary action. S-16 is the first
 * **Index** — a sortable table, status chips, two filter selects and a form, which between them
 * exercise the rules the identity screens never reach: table header semantics, `aria-sort`, a
 * control whose only label is visually hidden, and colour that must not be the sole carrier of a
 * state. It is also the first screen behind a session, so it costs a sign-in to reach.
 */
const RUN_PREFIX = `e2e-web-axe-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

test('axe finds no violations on the users and access screen', async ({ page }) => {
  const email = `${RUN_PREFIX}@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creează contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmă adresa' }).click();

  organizations.push(
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-org` }),
  );

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
  await page.waitForURL('**/home');

  await page.goto('/organization/users');
  await expect(page.getByRole('heading', { name: 'Utilizatori și acces', level: 1 })).toBeVisible();
  await scan(page);
});
