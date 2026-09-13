import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupOrganizations, seedOrganization } from './support/organizations';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator, type OperatorRole } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-02 in the browser (task 67.3) — the console as a Platform Administrator and a Billing Operator
 * meet it, against the built bundle and the real api.
 *
 * What only this suite can prove: that the register's view lives in the address (UX-4) — a search
 * and an open record survive a reload; that the record states the tenant-data boundary rather than
 * leaving a blank (§5.2's validation behaviour); that a Billing Operator who follows a link is told
 * who can read the register rather than shown an empty table; and that the whole surface passes axe.
 */
const RUN_PREFIX = `e2e-register-${process.pid}-${Date.now()}`;
const emailFor = (label: string) => `${RUN_PREFIX}-${label}@easyesg.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const randomOf = (alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const TOKEN = `rg${randomOf('abcdefghijklmnopqrstuvwxyz', 10)}`;
const ORGANIZATION = `Registru e2e ${TOKEN}`;

test.afterAll(async () => {
  await cleanupOperators(RUN_PREFIX);
  await cleanupOrganizations();
});

const provision = (email: string, role: OperatorRole) =>
  provisionOperator({ email, password: PASSWORD, totpSecret: TOTP_SECRET, role });

/** UC-68 through A-01's two steps, from wherever the page already is. */
async function signIn(page: Page, email: string) {
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuați' }).click();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(TOTP_SECRET));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
}

const recordPanel = (page: Page) => page.getByRole('complementary', { name: 'Fișa organizației' });

test('a Platform Administrator finds an organization and opens its record, which states the boundary', async ({
  page,
}) => {
  const email = emailFor('pa');
  provision(email, OPERATOR_ROLE.PLATFORM_ADMINISTRATOR);
  await seedOrganization({ name: ORGANIZATION, idno: `7${randomOf('0123456789', 12)}` });

  await page.goto('/sign-in');
  await signIn(page, email);
  await page.waitForURL('**/organizations');

  await expect(page.getByRole('heading', { level: 1, name: 'Organizații' })).toBeVisible();
  // The first destination in the console nav, and the current one (task 67.1's chrome, filled).
  await expect(
    page.getByRole('navigation', { name: 'Secțiunile consolei' }).getByRole('link', { name: 'Organizații' }),
  ).toHaveAttribute('aria-current', 'page');

  await page.getByLabel('Căutați după nume sau IDNO').fill(TOKEN);
  await page.getByRole('button', { name: 'Căutați', exact: true }).click();
  await page.waitForURL(/[?&]q=/u);

  await page.getByRole('button', { name: ORGANIZATION }).click();
  await page.waitForURL(/[?&]selected=/u);
  await expect(recordPanel(page)).toContainText(ORGANIZATION);
  await expect(recordPanel(page)).toContainText('Conținutul rapoartelor nu este afișat');

  // UX-4: the search and the open record are the address, so a reload reopens both.
  await page.reload();
  await expect(recordPanel(page)).toContainText(ORGANIZATION);
  await expect(page.getByLabel('Căutați după nume sau IDNO')).toHaveValue(TOKEN);
});

test('a Billing Operator who follows the register’s address is told who can read it', async ({ page }) => {
  const email = emailFor('bo');
  provision(email, OPERATOR_ROLE.BILLING_OPERATOR);

  await page.goto('/organizations');
  await page.waitForURL('**/sign-in?*redirect=*');
  await signIn(page, email);

  // The carried address wins over the operator's own home (A-01's exit), and the api refuses the read.
  await page.waitForURL('**/organizations');
  await expect(page.getByText('Registrul este accesibil administratorilor de platformă')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('axe finds no violations on the register with a record open', async ({ page }) => {
  const email = emailFor('axe');
  provision(email, OPERATOR_ROLE.PLATFORM_ADMINISTRATOR);
  const name = `Registru axe ${TOKEN}`;
  await seedOrganization({ name, idno: `8${randomOf('0123456789', 12)}` });

  await page.goto('/sign-in');
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await page.getByLabel('Căutați după nume sau IDNO').fill(TOKEN);
  await page.getByRole('button', { name: 'Căutați', exact: true }).click();
  await page.getByRole('button', { name }).click();
  await expect(recordPanel(page)).toBeVisible();
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  const landmarks = await new AxeBuilder({ page })
    .withRules(['landmark-one-main', 'landmark-unique', 'landmark-complementary-is-top-level'])
    .analyze();
  expect(landmarks.violations).toEqual([]);
});
