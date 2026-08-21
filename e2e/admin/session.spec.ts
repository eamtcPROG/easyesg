import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * Task 23's stated deliverable, literally: **admin sign-in/out e2e through the public
 * surface** — the console as an ordinary, cross-origin client of the one API (DR-11, AD-9,
 * OQ-17), TOTP challenged on every sign-in (FR-75).
 *
 * The journey runs against the built console bundle on its own origin, so the whole §12.5.6
 * posture is exercised for real: CORS with credentials, the `SameSite=Strict` cookie flowing
 * same-site cross-origin, the Origin proof on the sign-in POST. What the browser never holds,
 * asserted from inside it: no token, no readable session cookie.
 */
const RUN_PREFIX = `e2e-admin-${process.pid}-${Date.now()}`;
const emailFor = (label: string) => `${RUN_PREFIX}-${label}@easyesg.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test.afterAll(async () => {
  await cleanupOperators(RUN_PREFIX);
});

async function signIn(page: Page, email: string, code = currentTotpCode(TOTP_SECRET)) {
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Cod de verificare').fill(code);
  await page.getByRole('button', { name: 'Intră în consolă' }).click();
}

test('the realm is closed by default, admits credential + code, and signs out (UC-68)', async ({
  page,
}) => {
  const email = emailFor('happy');
  provisionOperator(email, PASSWORD, TOTP_SECRET);

  // Closed by default: the guarded screen bounces to A-01 with the destination carried.
  await page.goto('/organizations');
  await page.waitForURL('**/sign-in?*redirect=*');
  await expect(page.getByRole('heading', { name: 'Autentificare operator' })).toBeVisible();

  await signIn(page, email);

  // …and returns where the operator was headed (the console's UX-38).
  await page.waitForURL('**/organizations');
  await expect(page.getByText(email)).toBeVisible();

  // OQ-17's whole point, from inside the browser: nothing readable holds the session.
  const readable = await page.evaluate(() => document.cookie);
  expect(readable).not.toContain('easyesg_admin_session');

  await page.getByRole('button', { name: 'Ieși din consolă' }).click();
  await page.waitForURL('**/sign-in');

  // The session ended server-side too: the realm is closed again.
  await page.goto('/organizations');
  await page.waitForURL('**/sign-in?*redirect=*');
});

test('a wrong code refuses distinctly — the factor is disclosed only past the credential bar', async ({
  page,
}) => {
  const email = emailFor('factor');
  provisionOperator(email, PASSWORD, TOTP_SECRET);

  await page.goto('/sign-in');
  await signIn(page, email, '000000');

  // The api's resolved wording, as received — the screen branches on nothing (task 23).
  await expect(page.getByText('Cod de verificare incorect')).toBeVisible();
});

test('axe finds no violations on A-01', async ({ page }) => {
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
