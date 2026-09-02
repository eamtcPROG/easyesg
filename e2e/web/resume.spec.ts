import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  disclosureValueOf,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * Resuming a draft (task 35.3; UC-36, FR-39, UX-39) — the pattern's other half, and the half a
 * reload actually exercises: **a draft survives reload and a second device**, and the reporter is
 * put back where work stopped.
 *
 * "A second device" is a second browser context: no cookies, no IndexedDB, nothing shared with the
 * first but the account. What it sees is what the server holds, which is the whole claim.
 *
 * The third journey is OQ-60's return path: a change queued when the session is gone is submitted
 * once the reporter signs in again through `?return=` — UX-38's *"queued changes are submitted"*
 * half, proved; its inline re-authentication stays open under OQ-60.
 */
const RUN_PREFIX = `e2e-web-resume-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

/** B1's headcount and B3's first numeric — the catalogue's own Romanian labels, matched exactly. */
const EMPLOYEES = { elementKey: 'NumberOfEmployees', label: 'Numărul de angajați' };
const B3_ENERGY = { elementKey: 'TotalEnergyConsumption', label: 'Consumul total de energie' };

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function registered(page: Page, label: string): Promise<{ email: string; reportId: string; organizationId: string }> {
  const email = addressFor(label);
  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity` });
  return { email, reportId, organizationId };
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

const input = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true });

const answer = async (page: Page, target: { readonly label: string; readonly value: string }) => {
  const field = input(page, target.label);
  await field.fill(target.value);
  await field.press('Tab');
};

/**
 * A second device: a fresh context sharing nothing with the first but the account. A context
 * created from the `browser` fixture inherits none of the project's `use` — no `baseURL`, no
 * locale — so the project's options are passed through explicitly.
 */
async function secondDevice(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext(test.info().project.use);
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

test('a draft answered on one device is what a second device sees, at the step where work stopped (FR-39, UX-39)', async ({
  page,
  browser,
}) => {
  const { email, reportId, organizationId } = await registered(page, 'device');
  await signIn(page, email);

  // Work in B3 while B1 is still incomplete — the case that tells "where work stopped" apart from
  // "first incomplete" (UX-10), which is what the entry route answered before this task.
  await page.goto(`/reports/${reportId}/B3`);
  await answer(page, { label: B3_ENERGY.label, value: '1240' });
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: B3_ENERGY.elementKey }))
    .toMatchObject({ valueNumeric: '1240' });

  const other = await secondDevice(browser, email);
  await other.goto(`/reports/${reportId}`);
  // Position: B3, not B1.
  await other.waitForURL(`**/reports/${reportId}/B3`);
  // Values: the server's, with nothing carried over from the first device.
  await expect(input(other, B3_ENERGY.label)).toHaveValue('1240');
  await other.context().close();
});

test('opening a report nobody has answered still lands on the first incomplete step (UX-10)', async ({
  page,
}) => {
  const { email, reportId } = await registered(page, 'fresh');
  await signIn(page, email);
  await page.goto(`/reports/${reportId}`);
  await page.waitForURL(`**/reports/${reportId}/B1`);
});

test('a change queued while the session is gone is submitted after signing in again through the return path (OQ-60, UX-38)', async ({
  page,
  context,
}) => {
  const { email, reportId, organizationId } = await registered(page, 'expiry');
  await signIn(page, email);
  await page.goto(`/reports/${reportId}/B1`);

  // The session ends underneath the open wizard — the sealed cookie is gone, the page is not.
  await context.clearCookies();
  await answer(page, { label: EMPLOYEES.label, value: '12' });
  // The flush is refused (no session), and the queue keeps the change under the account's key.
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvarea nu a reușit/u);
  expect(await disclosureValueOf({ organizationId, reportId, elementKey: EMPLOYEES.elementKey })).toBeNull();

  // Reloading meets the proxy's gate, which sends the reporter to sign in and back to this step.
  await page.reload();
  await page.waitForURL(/\/sign-in\?return=/u);
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL(`**/reports/${reportId}/B1`);

  // Back on the step, the queue drains: the change made without a session is now the server's.
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: EMPLOYEES.elementKey }))
    .toMatchObject({ valueNumeric: '12' });
  await expect(input(page, EMPLOYEES.label)).toHaveValue('12');
});
