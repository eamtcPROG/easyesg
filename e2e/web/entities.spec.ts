import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-13 in a real browser (UC-52 … UC-55; FR-17 … FR-20; tasks 30.4.2 and 30.4.3).
 *
 * What only a round trip shows here is the classifier reaching the screen as **words**: the picker
 * searches a 996-entry vocabulary through a Server Action, the list resolves the codes an entity
 * already holds through a second mode of the same route, and the code that gets stored is the key
 * while everything the reader sees is a sentence. Three tasks' code has to agree for that, and
 * nothing hermetic can see it.
 *
 * Archiving is driven end to end for the same reason — §6.14's consequence dialogue names what
 * survives, and FR-20's guarantee is that the entity leaves selection while its reports do not.
 */
const RUN_PREFIX = `e2e-web-entities-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string, role?: 'editor' | 'viewer'): Promise<void> {
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
}

test('the first-use empty state teaches, and creating from it lands on the record', async ({
  page,
}) => {
  await signedIn(page, 'create');
  await page.goto('/entities');

  // §4.6: an Index "always has an empty state that teaches" — naming the object and offering the
  // one action that makes it, rather than a bare "no data".
  await expect(page.getByText('Nu aveți încă nicio entitate')).toBeVisible();
  await page.getByRole('link', { name: 'Adăugați prima entitate' }).click();
  await page.waitForURL('**/entities/new');

  await page.getByLabel('Denumirea entității').fill(`${RUN_PREFIX} Brutăria`);

  // The classifier, searched by a word rather than a code — the whole point of task 30.4.1.
  await page.getByLabel(/Activitățile entității/).fill('brutarie');
  const option = page.getByRole('option').first();
  await expect(option).toBeVisible();
  await option.press('Enter');

  // Chosen codes render as words with the key beside them; the key is what gets stored.
  await expect(page.getByText('10.7', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Adăugați entitatea' }).click();
  // Created entities get an address of their own, so a refresh does not make a second one.
  await page.waitForURL(/\/entities\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`${RUN_PREFIX} Brutăria`);

  // And the list now shows it, with its activity in words rather than as `10.7`.
  await page.goto('/entities');
  await expect(page.getByRole('link', { name: `${RUN_PREFIX} Brutăria` })).toBeVisible();
  await expect(page.getByText('Fabricarea produselor de brutărie')).toBeVisible();
});

test('sites and the reporting boundary are whole-collection saves (FR-19, UC-54)', async ({
  page,
}) => {
  await signedIn(page, 'boundary');
  await page.goto('/entities/new');

  await page.getByLabel('Denumirea entității').fill(`${RUN_PREFIX} Grup`);
  await page.getByRole('button', { name: 'Adăugați un amplasament' }).click();
  await page.getByLabel('Denumirea amplasamentului').fill('Depozit Strășeni');
  await page.getByRole('button', { name: 'Adăugați entitatea' }).click();
  await page.waitForURL(/\/entities\/[0-9a-f-]{36}$/);

  // Reloaded from the API, which is what says the collection was saved rather than held in a form.
  await page.reload();
  await expect(page.getByLabel('Denumirea amplasamentului')).toHaveValue('Depozit Strășeni');

  // VSME asks the boundary question explicitly, so nothing answers it by default — and setting
  // `consolidated` with no subsidiary is the API's refusal to make, not the screen's to pre-empt.
  await page.getByLabel('Baza de consolidare').click();
  await page.getByRole('option', { name: /Consolidată/ }).click();
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  // With a subsidiary inside the boundary it saves.
  await page.getByRole('button', { name: 'Adăugați o filială' }).click();
  await page.getByLabel('Denumirea filialei').fill('Lina Logistic SRL');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await expect(page.getByText('Entitatea a fost salvată')).toBeVisible();
});

test('archiving states its consequence, and the entity leaves active selection (FR-20)', async ({
  page,
}) => {
  await signedIn(page, 'archive');
  await page.goto('/entities/new');
  await page.getByLabel('Denumirea entității').fill(`${RUN_PREFIX} Veche`);
  await page.getByRole('button', { name: 'Adăugați entitatea' }).click();
  await page.waitForURL(/\/entities\/[0-9a-f-]{36}$/);

  await page.getByRole('button', { name: 'Arhivați entitatea', exact: true }).click();

  // §6.14 and UX-70: the dialogue names the object and what stops; UX-69's reassurance names what
  // survives, which for FR-20 is the whole reason archiving exists rather than deletion.
  await expect(page.getByRole('alertdialog')).toContainText(`${RUN_PREFIX} Veche`);
  await expect(page.getByRole('alertdialog')).toContainText('rămân disponibile');
  // Scoped to the dialogue rather than `.last()`. The two buttons legitimately share a name —
  // UX-70 wants the confirmation to restate the action rather than say "OK" — so the ambiguity is
  // the design, and naming WHERE the control is resolves it without loosening the locator.
  await page.getByRole('alertdialog').getByRole('button', { name: 'Arhivați entitatea' }).click();

  await page.waitForURL('**/entities');
  // Still listed — FR-20 removes it from active *selection*, and it stays readable deliberately.
  // `Filtrați după stare`, not `Starea`: the filter and the table's column header used to share a
  // name, so both this locator and a screen reader met two controls called the same thing. The
  // catalogue changed rather than the locator — a duplicate accessible name is the defect, and a
  // `.first()` here would have been its only record.
  await page.getByLabel('Filtrați după stare').click();
  await page.getByRole('option', { name: 'Doar arhivate' }).click();
  await expect(page.getByRole('link', { name: `${RUN_PREFIX} Veche` })).toBeVisible();

  // And its master data is frozen: UX-13 requires the read-only state to name its cause.
  await page.getByRole('link', { name: `${RUN_PREFIX} Veche` }).click();
  await expect(page.getByText('Entitate arhivată')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvați modificările' })).toHaveCount(0);
});

test('the filter lives in the address, and its empty state is not the first-use one', async ({
  page,
}) => {
  await signedIn(page, 'filter');
  await page.goto('/entities/new');
  await page.getByLabel('Denumirea entității').fill(`${RUN_PREFIX} Activă`);
  await page.getByRole('button', { name: 'Adăugați entitatea' }).click();
  await page.waitForURL(/\/entities\/[0-9a-f-]{36}$/);

  await page.goto('/entities?standing=archived');
  // Rows exist and none matched — §4.6 needs this apart from "you have no entities", because the
  // remedy is different: clear the filter, not create your first object.
  await expect(page.getByText('Nicio entitate nu corespunde filtrului')).toBeVisible();
  await page.getByRole('button', { name: 'Ștergeți filtrul' }).click();
  await expect(page.getByRole('link', { name: `${RUN_PREFIX} Activă` })).toBeVisible();
});

test('the screen is live in all three locales', async ({ page }) => {
  await signedIn(page, 'locales');

  await page.goto('/entities');
  await expect(page.getByRole('heading', { name: 'Entități raportoare', level: 1 })).toBeVisible();

  await page.goto('/en/entities');
  await expect(page.getByRole('heading', { name: 'Reporting entities', level: 1 })).toBeVisible();

  await page.goto('/ru/entities');
  await expect(
    page.getByRole('heading', { name: 'Отчитывающиеся организации', level: 1 }),
  ).toBeVisible();
});
