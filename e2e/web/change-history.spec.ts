import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { settleAnimations } from './support/animations';
import {
  addMember,
  cleanupAccounts,
  cleanupOrganizations,
  disclosureValueOf,
  grantMembership,
  seedOpenPeriod,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { untilHydrated } from './support/hydration';

/**
 * S-12 in a real browser (task 84.2; UC-47; FR-54, FR-55; `architecture.md` §12.5.6's task-84 row): reached from the
 * field on S-07 (UX-68), from S-13's record and from S-15's attribution line — the entries newest first, worded, with
 * who made each change — and offered to no one who may not read the trail (182/22).
 *
 * **What only a browser can prove** is that the way in is on the screen the reader is on, that the panel opens beside
 * the page without taking it, and that closing it lands focus back where it was opened; the entries' content is
 * `change-history.e2e-spec.ts`'s, over the api.
 */
const RUN_PREFIX = `e2e-web-history-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function registered(page: Page, label: string): Promise<string> {
  const email = addressFor(label);
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Rusu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Am citit și accept/ }).check();
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  return email;
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

/** A new account, the only member of a new organization, in the role asked — and signed in. */
async function signedIn(
  page: Page,
  label: string,
  role: 'editor' | 'viewer' | 'organization_administrator' = 'organization_administrator',
): Promise<{ readonly email: string; readonly organizationId: string }> {
  const email = await registered(page, label);
  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}`, role });
  organizations.push(organizationId);
  await signIn(page, email);
  return { email, organizationId };
}

test('a field’s footer counts its changes and opens its history beside the step; a viewer is offered none (UX-68)', async ({
  page,
  browser,
}) => {
  const { organizationId } = await signedIn(page, 'field', 'editor');
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-Brutăria` });

  await page.goto(`/reports/${reportId}/B1`);
  const field = page.getByRole('group', { name: 'Numărul de angajați' });
  const employees = field.getByRole('textbox');
  await untilHydrated(employees);
  const stored = async () => (await disclosureValueOf({ organizationId, reportId, elementKey: 'NumberOfEmployees' }))?.valueNumeric;
  for (const value of ['12', '15']) {
    await employees.fill(value);
    await employees.blur();
    await expect.poll(stored, { timeout: 15_000 }).toBe(value);
  }

  // The count is the step read's, so it reads the field's changes as the page is drawn.
  await page.reload();
  const footer = field.getByRole('button', { name: 'Modificat de 2 ori · istoric' });
  await untilHydrated(footer);
  await footer.click();

  const panel = page.getByRole('dialog', { name: 'Istoricul modificărilor' });
  await expect(panel).toContainText('Numărul de angajați');
  const entries = panel.getByRole('listitem');
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('12 → 15');
  await expect(entries.first()).toContainText('Actuală');
  await expect(entries.first()).toContainText('Ana Rusu · dumneavoastră');
  await expect(entries.first()).toContainText('introdusă în raport');
  await expect(entries.last()).toContainText('— → 12');
  // No internal identifier reaches it (the user-facing-text rule): the element's key is nowhere on the panel.
  await expect(panel).not.toContainText('NumberOfEmployees');

  // Non-modal: the step beside it is still the reader's.
  await expect(employees).toBeEditable();
  await settleAnimations(page);
  const scan = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(scan.violations).toEqual([]);

  await panel.getByRole('button', { name: 'Închideți' }).click();
  await expect(panel).toHaveCount(0);
  await expect(footer).toBeFocused();

  // A view-only member reads the step and is offered no way into a trail the api would refuse them (182/22).
  // In a browser of their own: the register screen turns away a reader who already holds a session (UX-136).
  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  const viewerEmail = await registered(viewer, 'viewer');
  await addMember({ email: viewerEmail, organizationId, role: 'viewer' });
  await signIn(viewer, viewerEmail);
  await viewer.goto(`/reports/${reportId}/B1`);
  const seen = viewer.getByRole('group', { name: 'Numărul de angajați' });
  await expect(seen).toContainText('15');
  await expect(seen.getByRole('button', { name: /istoric/u })).toHaveCount(0);
  await viewerContext.close();
});

test('the entity record opens its own fields’ history, the platform’s first entry beneath the reader’s change', async ({
  page,
}) => {
  const { organizationId } = await signedIn(page, 'entity');
  const name = `${RUN_PREFIX} Cofetăria`;
  const { entityId } = await seedOpenPeriod({ organizationId, name });

  await page.goto(`/entities/${entityId}`);
  await page.getByLabel('Denumirea entității').fill(`${name} SRL`);
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await expect(page.getByText('Entitatea a fost salvată')).toBeVisible();

  const side = page.getByRole('region', { name: 'Istoricul modificărilor' });
  const open = side.getByRole('button', { name: 'Vedeți istoricul' });
  await untilHydrated(open);
  await open.click();

  const panel = page.getByRole('dialog', { name: 'Istoricul modificărilor' });
  const entries = panel.getByRole('listitem');
  await expect(entries.first()).toContainText('Denumirea entității');
  await expect(entries.first()).toContainText(`${name} → ${name} SRL`);
  await expect(entries.first()).toContainText('dumneavoastră');
  // The fixture wrote the entity with no person bound, so its creation is the platform's — and an entity's history
  // states no source, which is a disclosure value's alone.
  await expect(entries.last()).toContainText('Platforma easyESG');
  await expect(entries.last()).not.toContainText('introdusă în raport');
});

test('the organization’s attribution line opens its history (FR-15, FR-54)', async ({ page }) => {
  await signedIn(page, 'organization');
  await page.goto('/organization');
  await page.getByLabel('Telefon', { exact: true }).fill('+373 22 000 000');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await expect(page.getByText('Profilul a fost salvat')).toBeVisible();

  const open = page.getByRole('button', { name: 'Vedeți istoricul' });
  await untilHydrated(open);
  await open.click();

  const panel = page.getByRole('dialog', { name: 'Istoricul modificărilor' });
  await expect(panel).toContainText(`${RUN_PREFIX}-organization`);
  await expect(panel.getByRole('listitem').first()).toContainText('Telefonul');
  await expect(panel.getByRole('listitem').first()).toContainText('— → +373 22 000 000');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(open).toBeFocused();
});
