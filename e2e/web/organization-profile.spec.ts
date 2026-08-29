import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-15 in a real browser (UC-50, UC-51; FR-15, FR-16; task 30.3).
 *
 * Three things only a round trip shows, and each is a different task's code agreeing with another's:
 *
 *  - **The identifier rules are the API's own.** `@easyesg/validation` refuses a malformed LEI
 *    inline and the API re-validates the same value with the same functions (§9.8) — so what this
 *    proves is not that a regex works but that one implementation serves both, which is the whole
 *    reason that package exists.
 *  - **The attribution names the person who just saved.** It is read from `core.field_change`, a
 *    table written by a trigger inside the same transaction as the write, and `updateProfile`
 *    re-reads rather than using `RETURNING` precisely so the line is not the state before the
 *    change. Nothing hermetic can see that ordering.
 *  - **A legal-form key resolves to a sentence.** The form arrives as `srl` and the catalogue is
 *    what makes it readable; a key on the screen is the defect CLAUDE.md's user-facing-text rule
 *    names, and it renders identically to a correct label until somebody reads it.
 */
const RUN_PREFIX = `e2e-web-profile-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

/** A published LEI, so the MOD 97-10 fixture is a real value rather than one this suite produced. */
const VALID_LEI = '7LTWFZYICNSX8D621K86';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string, role?: 'editor' | 'viewer'): Promise<string> {
  const email = addressFor(label);

  await page.goto('/register');
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

  // A configuration key resolved to a sentence — `srl` never reaches the screen.
  await page.getByLabel('Forma juridică').click();
  await page.getByRole('option', { name: 'Societate cu răspundere limitată (SRL)' }).click();

  await page.getByLabel('Localitatea').fill('Chișinău');
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
  await expect(page.getByLabel('Localitatea')).toHaveValue('Chișinău');
  await expect(page.getByLabel('Forma juridică')).toHaveText(/Societate cu răspundere limitată/);
});

test('an identifier is refused with a sentence that says which half is wrong (FR-16)', async ({
  page,
}) => {
  await signedIn(page, 'identifiers');
  await page.goto('/organization');

  // Shape and check digits are two verdicts with two resolutions — retype it, versus check you
  // copied the right one. A single boolean would say neither.
  await page.getByLabel('IDNO').fill('123');
  await page.getByLabel('Identificator de entitate juridică (LEI)', { exact: false }).fill('NOT-A-LEI');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await expect(page.getByText('IDNO-ul nu are 13 cifre', { exact: false })).toHaveCount(2);
  await expect(page.getByText('Codul LEI nu are 20 de caractere', { exact: false })).toHaveCount(2);

  // Twenty valid characters whose check digits disagree: the shape passes and the checksum does
  // not, which is the sentence the other message cannot say.
  await page.getByLabel('Identificator de entitate juridică (LEI)', { exact: false }).fill('7LTWFZYICNSX8D621K00');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await expect(page.getByText('Cifrele de control ale codului LEI', { exact: false })).toHaveCount(2);

  // And the pair the API accepts, which is the same rule running on the other side of the wire.
  await page.getByLabel('IDNO').fill('1003600158022');
  await page.getByLabel('Identificator de entitate juridică (LEI)', { exact: false }).fill(VALID_LEI);
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await expect(page.getByText('Profilul a fost salvat')).toBeVisible();
});

test('the two contacts are separate fields, and the report one says so', async ({ page }) => {
  await signedIn(page, 'contacts');
  await page.goto('/organization');

  await page.getByLabel('E-mail de contact cu platforma').fill(`platforma-${RUN_PREFIX}@example.md`);
  await page.getByLabel('E-mailul tipărit pe raport').fill(`raport-${RUN_PREFIX}@example.md`);
  await page.getByLabel('Persoana de contact tipărită pe raport').fill('Ana Rusu');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await expect(page.getByText('Profilul a fost salvat')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('E-mail de contact cu platforma')).toHaveValue(
    `platforma-${RUN_PREFIX}@example.md`,
  );
  await expect(page.getByLabel('E-mailul tipărit pe raport')).toHaveValue(
    `raport-${RUN_PREFIX}@example.md`,
  );
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
  // The LEI label carries its expansion in every locale and is never the bare abbreviation
  // (design_spec S-15, 28 Aug 2026) — to a Moldovan reader `LEI` reads as the currency.
  await expect(page.getByLabel('Legal Entity Identifier (LEI)')).toBeVisible();

  await page.goto('/ru/organization');
  await expect(page.getByRole('heading', { name: 'Профиль организации', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Идентификатор юридического лица (LEI)')).toBeVisible();
});
