import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-13 in a real browser (UC-51 … UC-55; FR-16 … FR-20; tasks 30.4.2, 30.4.3 and 175).
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
  // `exact`, because the row's own action is a link too, named *Editați* and then the entity.
  await expect(page.getByRole('link', { name: `${RUN_PREFIX} Brutăria`, exact: true })).toBeVisible();
  await expect(page.getByText('Fabricarea produselor de brutărie')).toBeVisible();

  // 29 Sep 2026, project owner: the row says how to change it. The visible word is the verb and the name is the row's.
  const edit = page.getByRole('link', { name: `Editați ${RUN_PREFIX} Brutăria`, exact: true });
  await expect(edit).toHaveText('Editați');
  await edit.click();
  await page.waitForURL(/\/entities\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`${RUN_PREFIX} Brutăria`);
});

test('the create form keeps its section and its way back, and the picker offers classes before any typing', async ({
  page,
}) => {
  await signedIn(page, 'wayback');
  await page.goto('/entities');

  // 28 Sep 2026: the add action stands in the filter row, and the section stays current beneath the index.
  await page.getByRole('link', { name: 'Adăugați o entitate' }).click();
  await page.waitForURL('**/entities/new');
  const tier = page.getByRole('navigation', { name: 'Secțiunile organizației' });
  await expect(tier.getByRole('link', { name: 'Entități' })).toHaveAttribute('aria-current', 'page');
  await expect(tier.locator('[aria-current="page"]')).toHaveCount(1);

  // The classifier's first classes, read with the page — the api answers an empty query with them since that date.
  await page.getByLabel(/Activitățile entității/).focus();
  await expect(page.getByRole('option')).toHaveCount(10);
  await expect(page.getByRole('option').first()).toContainText('01.11');

  await page.getByRole('navigation', { name: 'Firimituri' }).getByRole('link', { name: 'Entități raportoare' }).click();
  await page.waitForURL(/\/entities$/);
});

test('the arrow and the breadcrumb ask before leaving unsaved changes, and not otherwise', async ({ page }) => {
  // 28 Sep 2026, project owner: a go-back arrow before the title, and a question before the record's ways back lose work.
  await signedIn(page, 'leave');
  await page.goto('/entities/new');
  await page.getByRole('link', { name: 'Înapoi la entitățile raportoare' }).click();
  await page.waitForURL(/\/entities$/);

  await page.goto('/entities/new');
  await page.getByLabel('Denumirea entității').fill(`${RUN_PREFIX} Ciornă`);
  await page.getByRole('link', { name: 'Înapoi la entitățile raportoare' }).click();
  const question = page.getByRole('alertdialog');
  await expect(question).toContainText('Plecați fără să salvați?');
  await question.getByRole('button', { name: 'Rămâneți pe pagină' }).click();
  await expect(page).toHaveURL(/\/entities\/new$/);
  await expect(page.getByLabel('Denumirea entității')).toHaveValue(`${RUN_PREFIX} Ciornă`);

  await page.getByRole('navigation', { name: 'Firimituri' }).getByRole('link', { name: 'Entități raportoare' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Plecați fără să salvați' }).click();
  await page.waitForURL(/\/entities$/);
  await expect(page.getByText(`${RUN_PREFIX} Ciornă`)).toHaveCount(0);
});

test('one press removes a site nobody has named yet', async ({ page }) => {
  // 29 Sep 2026, project owner: the press that took focus off the blank name showed its "required" message, the row
  // grew, and the removal moved out from under the pointer before the click completed — so it took two presses. Only a
  // real layout can show that, which is why this is a browser case.
  await signedIn(page, 'blankremove');
  await page.goto('/entities/new');
  await page.getByRole('button', { name: 'Adăugați un amplasament' }).click();
  await expect(page.getByLabel('Denumirea amplasamentului')).toBeFocused();

  await page.getByRole('button', { name: 'Ștergeți amplasamentul Amplasamentul 1' }).click();

  await expect(page.getByLabel('Denumirea amplasamentului')).toHaveCount(0);
  await expect(page.getByText('Scrieți denumirea amplasamentului')).toHaveCount(0);
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
  await expect(page.getByRole('link', { name: `${RUN_PREFIX} Veche`, exact: true })).toBeVisible();

  // An archived row's action says it opens to be read, since nothing on the record can change.
  const view = page.getByRole('link', { name: `Vedeți ${RUN_PREFIX} Veche`, exact: true });
  await expect(view).toHaveText('Vedeți');
  await expect(page.getByRole('link', { name: `Editați ${RUN_PREFIX} Veche` })).toHaveCount(0);

  // And its master data is frozen: UX-13 requires the read-only state to name its cause.
  await view.click();
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
  await expect(page.getByRole('link', { name: `${RUN_PREFIX} Activă`, exact: true })).toBeVisible();
});

/**
 * FR-16 on the entity (task 175, which moved it here from S-15): `@easyesg/validation` refuses a malformed identifier
 * inline and the API re-validates the same value with the same functions (§9.8) — so what this proves is not that a
 * regex works but that one implementation serves both. Shape and check digits are two verdicts with two resolutions,
 * retype it versus check you copied the right one, which a single boolean would collapse.
 */
test('an identifier is refused with a sentence that says which half is wrong, and the IDNO reaches the list', async ({
  page,
}) => {
  await signedIn(page, 'identifiers');
  await page.goto('/entities/new');
  await page.getByLabel('Denumirea entității').fill(`${RUN_PREFIX} Identificatori`);

  const lei = page.getByLabel('Identificator de entitate juridică (LEI)', { exact: false });
  await page.getByLabel('IDNO').fill('123');
  await lei.fill('NOT-A-LEI');
  await page.getByRole('button', { name: 'Adăugați entitatea' }).click();
  // Twice each: inline beside the field, and in the summary that links to it (UX-111).
  await expect(page.getByText('IDNO-ul nu are 13 cifre', { exact: false })).toHaveCount(2);
  await expect(page.getByText('Codul LEI nu are 20 de caractere', { exact: false })).toHaveCount(2);

  // Twenty valid characters whose check digits disagree: the shape passes and the checksum does not.
  await lei.fill('7LTWFZYICNSX8D621K00');
  await page.getByRole('button', { name: 'Adăugați entitatea' }).click();
  await expect(page.getByText('Cifrele de control ale codului LEI', { exact: false })).toHaveCount(2);

  // A published LEI, so the MOD 97-10 fixture is a real value rather than one this suite produced.
  await page.getByLabel('IDNO').fill('1003600158022');
  await lei.fill('7ltwfzyicnsx8d621k86');
  await page.getByRole('button', { name: 'Adăugați entitatea' }).click();
  await page.waitForURL(/\/entities\/[0-9a-f-]{36}$/);
  // Stored in its canonical form, so the record re-seeded from the answer is not dirty.
  await expect(lei).toHaveValue('7LTWFZYICNSX8D621K86');

  await page.goto('/entities');
  const row = page.getByRole('row').filter({ hasText: `${RUN_PREFIX} Identificatori` });
  await expect(row).toContainText('1003600158022');
});

test('the screen is live in all three locales', async ({ page }) => {
  await signedIn(page, 'locales');

  await page.goto('/entities');
  await expect(page.getByRole('heading', { name: 'Entități raportoare', level: 1 })).toBeVisible();

  await page.goto('/en/entities');
  await expect(page.getByRole('heading', { name: 'Reporting entities', level: 1 })).toBeVisible();
  // The LEI label carries its expansion in every locale and is never the bare abbreviation (design_spec S-13's LEI
  // rule, S-15's until task 175) — to a Moldovan reader `LEI` reads as the currency.
  await page.goto('/en/entities/new');
  await expect(page.getByLabel('Legal Entity Identifier (LEI)', { exact: false })).toBeVisible();

  await page.goto('/ru/entities');
  await expect(
    page.getByRole('heading', { name: 'Отчитывающиеся организации', level: 1 }),
  ).toBeVisible();
  await page.goto('/ru/entities/new');
  await expect(page.getByLabel('Идентификатор юридического лица (LEI)', { exact: false })).toBeVisible();
});
