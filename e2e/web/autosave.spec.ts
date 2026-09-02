import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  disclosureValueOf,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * S-07's draft-integrity pattern (task 35.2; UC-35, FR-37, FR-38, UX-34 … UX-37) — the claims the
 * deliverable makes, in a real browser against the real API: **every field change persists with no
 * explicit save, and the indicator tells the truth about pending writes.**
 *
 * Why a browser and not a unit: "persists" is a row in the database after a blur, "no explicit
 * save" is the absence of a control, and "the truth about pending writes" is what the indicator
 * says while the network is actually down. Playwright's `setOffline` is the one harness that can
 * make the last of those true rather than simulated, and `disclosureValueOf` reads the row itself
 * so the acknowledgement is checked against the commit it claims (NFR-56).
 *
 * The report is seeded straight to the database (task 35.1's `seedReport`) because there is no
 * way into the wizard through the product yet — S-06 and report creation are tasks 32.2.2 and 32.3.
 */
const RUN_PREFIX = `e2e-web-autosave-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

/** B1's headcount and turnover — the catalogue's own Romanian labels, matched exactly. */
const EMPLOYEES = { elementKey: 'NumberOfEmployees', label: 'Numărul de angajați' };
const TURNOVER = { elementKey: 'Turnover', label: 'Cifra de afaceri' };

const SAVE_STATE_REGION = 'Starea salvării';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(
  page: Page,
  label: string,
  role?: 'editor' | 'viewer',
): Promise<{ reportId: string; organizationId: string }> {
  const email = addressFor(label);

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-${label}`,
    role,
  });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity` });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  return { reportId, organizationId };
}

const openB1 = async (page: Page, reportId: string) => {
  await page.goto(`/reports/${reportId}/B1`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B1');
};

const saveState = (page: Page) => page.getByRole('status', { name: SAVE_STATE_REGION });

/**
 * The input for one question. `textbox` by name rather than `getByLabel`: the disclosure field's
 * group carries the same accessible name as its input on purpose (one visible label, UX-110), so a
 * label query resolves to both.
 */
const input = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true });

/** Blur is the commit (FR-37): fill, then move focus away. A named object, not two adjacent strings. */
const answer = async (page: Page, target: { readonly label: string; readonly value: string }) => {
  const field = input(page, target.label);
  await field.fill(target.value);
  await field.press('Tab');
};

test('a value persists on blur with no save action, and reloads from the server (FR-37, UX-34, UX-36)', async ({
  page,
}) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'blur');
  await openB1(page, reportId);

  // UX-34: there is no save button in the wizard.
  await expect(page.getByRole('button', { name: /salv/iu })).toHaveCount(0);
  await expect(saveState(page)).toHaveText(/Salvat/u);

  await answer(page, { label: EMPLOYEES.label, value: '42' });

  // The row is the acknowledgement: what the indicator says is checked against what committed.
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: EMPLOYEES.elementKey }))
    .toMatchObject({ valueNumeric: '42', state: 'ok' });
  await expect(saveState(page)).toHaveText(/Salvat/u);

  // Read back from the server, not from the browser's state.
  await page.reload();
  await expect(input(page, EMPLOYEES.label)).toHaveValue('42');
});

test('a value that is not a number is refused at the field and never sent', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'invalid');
  await openB1(page, reportId);

  await answer(page, { label: EMPLOYEES.label, value: 'abc' });

  await expect(page.getByText('Valoarea nu este un număr.', { exact: false })).toBeVisible();
  await expect(saveState(page)).toHaveText(/Salvat/u);
  expect(
    await disclosureValueOf({ organizationId, reportId, elementKey: EMPLOYEES.elementKey }),
  ).toBeNull();
});

test('offline changes queue, the reader is warned, and the queue drains on reconnection (FR-38, UX-35, UX-37)', async ({
  page,
  context,
}) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'offline');
  await openB1(page, reportId);

  await context.setOffline(true);
  await answer(page, { label: TURNOVER.label, value: '1000' });

  // UX-35's third state, and UX-37's standing warning — in that order, both text.
  await expect(saveState(page)).toHaveText(/În așteptare — fără conexiune/u);
  await expect(page.getByText('Modificările nu au fost încă trimise')).toBeVisible();
  expect(
    await disclosureValueOf({ organizationId, reportId, elementKey: TURNOVER.elementKey }),
  ).toBeNull();

  await context.setOffline(false);

  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: TURNOVER.elementKey }))
    .toMatchObject({ valueNumeric: '1000' });
  await expect(saveState(page)).toHaveText(/Salvat/u);
  await expect(page.getByText('Modificările nu au fost încă trimise')).toHaveCount(0);
});

test('a queued change survives the tab being closed and is sent when the report is next opened (FR-38, §4.10)', async ({
  page,
  context,
}) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'durable');
  await openB1(page, reportId);

  await context.setOffline(true);
  await answer(page, { label: EMPLOYEES.label, value: '7' });
  await expect(saveState(page)).toHaveText(/În așteptare/u);

  // Close the tab with the change still queued. Nothing has reached the API.
  await page.close();
  expect(
    await disclosureValueOf({ organizationId, reportId, elementKey: EMPLOYEES.elementKey }),
  ).toBeNull();

  // A new tab, connection back: opening the report drains what the old tab left in IndexedDB.
  await context.setOffline(false);
  const next = await context.newPage();
  await openB1(next, reportId);
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: EMPLOYEES.elementKey }))
    .toMatchObject({ valueNumeric: '7' });
  await expect(saveState(next)).toHaveText(/Salvat/u);
});

test('leaving the wizard with unsent changes asks first, with a chance to stay (UX-37)', async ({
  page,
  context,
}) => {
  const { reportId } = await signedInWithReport(page, 'leave');
  await openB1(page, reportId);

  await context.setOffline(true);
  await answer(page, { label: EMPLOYEES.label, value: '3' });
  await expect(saveState(page)).toHaveText(/În așteptare/u);

  await page.getByRole('link', { name: /Ieșiți din raport/u }).click();
  const dialogue = page.getByRole('alertdialog');
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText('Ieșiți cu modificări netrimise?');

  await dialogue.getByRole('button', { name: 'Rămâneți în raport' }).click();
  await expect(dialogue).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}/B1$`, 'u'));
  await context.setOffline(false);
});

test('a view-only member sees the same step read-only, told why and what restores editing (UX-13)', async ({
  page,
}) => {
  const { reportId } = await signedInWithReport(page, 'viewer', 'viewer');
  await openB1(page, reportId);

  await expect(page.getByText('Aveți acces doar pentru citire')).toBeVisible();
  // Affordances removed, not disabled: no input for the question, and no save state to report.
  await expect(input(page, EMPLOYEES.label)).toHaveCount(0);
  await expect(page.getByRole('status', { name: SAVE_STATE_REGION })).toHaveCount(0);
  // The question is still on the screen, with its answer state.
  await expect(page.getByRole('group', { name: EMPLOYEES.label })).toBeVisible();
});
