import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-15 in a real browser (UC-50; FR-15; task 30.3) — **the account**, since task 177: its name, country and how
 * easyESG reaches it. What a report prints is each company's — the identifiers since task 175, the legal form, the
 * registered address and the report contact since 177 — and those journeys are `entities.spec.ts`'s.
 *
 * What only a round trip shows here:
 *
 *  - **The attribution names the person who just saved.** It is read from `core.field_change`, a
 *    table written by a trigger inside the same transaction as the write, and `updateProfile`
 *    re-reads rather than using `RETURNING` precisely so the line is not the state before the
 *    change. Nothing hermetic can see that ordering.
 *  - **The screen says what it is not.** A reader looking for what a report prints is told where it is, and
 *    finds no field for it here.
 */
const RUN_PREFIX = `e2e-web-profile-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string, role?: 'editor' | 'viewer'): Promise<string> {
  const email = addressFor(label);

  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}`, role }),
  );

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return email;
}

test('the administrator edits the profile, and save is inert until something differs', async ({
  page,
}) => {
  const email = await signedIn(page, 'edit');
  await page.goto('/organization');

  await expect(page.getByRole('heading', { name: 'Profilul organizației', level: 1 })).toBeVisible();

  // The artboard states this in words rather than leaving a greyed control to imply it (UX-102).
  await expect(page.getByText('Nimic modificat încă', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvați modificările' })).toBeDisabled();

  // Task 177: the account holds nothing a report prints, and says where that is.
  await expect(page.getByText('Ce se tipărește în rapoarte ține de fiecare companie', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Forma juridică')).toHaveCount(0);

  await page.getByLabel('Telefon', { exact: true }).fill('+373 22 000 000');
  await expect(page.getByRole('button', { name: 'Salvați modificările' })).toBeEnabled();
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await expect(page.getByText('Profilul a fost salvat')).toBeVisible();
  // Re-seeded from what was STORED, so the form is clean again — the assertion that makes the
  // dirty gate honest rather than a control that never re-arms.
  await expect(page.getByRole('button', { name: 'Salvați modificările' })).toBeDisabled();

  // FR-15's attribution, naming the person who just saved. Read from the audit trail the trigger
  // wrote inside the same transaction.
  await expect(page.getByText(`Ultima modificare: ${email}`, { exact: false })).toBeVisible();

  // It survives a reload, which is what says it was stored rather than held in the form.
  await page.reload();
  await expect(page.getByLabel('Telefon', { exact: true })).toHaveValue('+373 22 000 000');
});

test('the contact is easyESG’s own, and the report’s is not asked for here', async ({ page }) => {
  await signedIn(page, 'contacts');
  await page.goto('/organization');

  // One contact, whose it is in its label; the report's contact is each company's, on S-13 (task 177).
  await page.getByLabel('E-mail pentru mesajele easyESG').fill(`platforma-${RUN_PREFIX}@example.md`);
  await expect(page.getByLabel('E-mailul persoanei de contact')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await expect(page.getByText('Profilul a fost salvat')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('E-mail pentru mesajele easyESG')).toHaveValue(`platforma-${RUN_PREFIX}@example.md`);
});

test('a member who does not administer the organization is told so, not shown an error', async ({
  page,
}) => {
  await signedIn(page, 'viewer', 'viewer');
  await page.goto('/organization');

  // UX-1: the boundary is explained by the screen that enforces it, and it names who can grant
  // access rather than rendering an error page.
  await expect(page.getByText('Nu aveți acces la profilul organizației')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reveniți la prima pagină' })).toBeVisible();
});

test('the screen is live in all three locales', async ({ page }) => {
  await signedIn(page, 'locales');

  await page.goto('/organization');
  await expect(page.getByRole('heading', { name: 'Profilul organizației', level: 1 })).toBeVisible();

  await page.goto('/en/organization');
  await expect(page.getByRole('heading', { name: 'Organisation profile', level: 1 })).toBeVisible();

  await page.goto('/ru/organization');
  await expect(page.getByRole('heading', { name: 'Профиль организации', level: 1 })).toBeVisible();
});
