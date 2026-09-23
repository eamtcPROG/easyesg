import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, verificationTokenFor } from './support/db';
import { PASSWORD } from './support/second-factor';
import { accountTrigger } from './support/session';

/**
 * S-27 — profile, languages and notification preferences (task 52.3; UC-13, UC-14, UC-168), from the browser.
 *
 * What is worth a browser journey rather than a unit spec is what only the round trip shows: **a rename reaches the
 * global tier at once** — the session renewed by the save, not by the next rotation; **a new interface language
 * reloads the screen in it**, the one honest way to apply a language the address carries; **a switch-off survives a
 * reload**, so it reached the preferences' own table through the same save; and the ways in — the account menu and
 * S-26 — arrive where they say.
 */
const RUN_PREFIX = `task52-3-${process.pid}-${Date.now()}`;
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** Registration → verification → membership → sign-in, all through the shipped routes (S-28's journey's). */
async function signedIn(page: Page, label: string): Promise<string> {
  const email = `${RUN_PREFIX}-${label}@example.md`;

  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return email;
}

test('the account menu leads to S-27, which shows the record and passes axe', async ({ page }) => {
  const email = await signedIn(page, 'menu');

  await accountTrigger(page, { email }).click();
  await page.getByRole('menuitem', { name: 'Profil și preferințe' }).click();
  await page.waitForURL('**/account');

  await expect(page.getByRole('heading', { level: 1, name: 'Profil și preferințe' })).toBeVisible();
  await expect(page.getByLabel('Prenume')).toHaveValue('Ana');
  // Exactly one control named for the address: the email language's select is named for what it is (found by this
  // journey — both were *E-mail*, which a screen reader could not tell apart either).
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(email);
  await expect(page.getByText('Apare în aplicație ca: Ana Popescu')).toBeVisible();
  // A category nobody may switch off is drawn locked, with its reason, and offers no control.
  const reset = page.getByRole('group', { name: 'Resetarea parolei' });
  await expect(reset.getByText(/Nu poate fi dezactivată/)).toBeVisible();
  await expect(reset.getByRole('checkbox')).toHaveCount(0);

  const scan = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(scan.violations).toEqual([]);
});

test('a rename reaches the global tier at once, and the phone is kept in one spelling', async ({ page }) => {
  const email = await signedIn(page, 'rename');
  await page.goto('/account');

  await page.getByLabel('Prenume').fill('Ioana');
  await page.getByLabel('Funcția').fill('Contabilă-șefă');
  await page.getByLabel('Telefon').fill('+373 69 123 456');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await expect(page.getByText('Profil salvat')).toBeVisible();
  await expect(page.getByText('Apare în aplicație ca: Ioana Popescu')).toBeVisible();
  await expect(page.getByLabel('Telefon')).toHaveValue('+37369123456');
  await expect(accountTrigger(page, { email, displayName: 'Ioana Popescu' })).toBeVisible();
});

test('a phone number in no international form is refused in the api’s own words, and nothing is saved', async ({ page }) => {
  await signedIn(page, 'phone');
  await page.goto('/account');

  await page.getByLabel('Funcția').fill('Controlor');
  await page.getByLabel('Telefon').fill('069 123 456');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await expect(page.getByText(/nu este în format internațional/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Funcția')).toHaveValue('');
});

/**
 * The partial write: the preferences are saved first, so a profile then refused leaves them written — the refusal is
 * shown, and a reload finds the switch kept and the refused profile field unchanged (task 52's close review).
 */
test('a switch saved beside a refused profile stays saved, and the refusal says why', async ({ page }) => {
  await signedIn(page, 'partial');
  await page.goto('/account');

  await page.getByRole('group', { name: 'Mementouri' }).getByLabel('Prin e-mail').uncheck();
  await page.getByLabel('Telefon').fill('069 123 456');
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await expect(page.getByText(/nu este în format internațional/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('group', { name: 'Mementouri' }).getByLabel('Prin e-mail')).not.toBeChecked();
  await expect(page.getByLabel('Telefon')).toHaveValue('');
});

test('a switch-off survives a reload, and S-26 leads to it', async ({ page }) => {
  await signedIn(page, 'switch');
  await page.goto('/notifications');
  await page.getByRole('link', { name: 'Alegeți ce vă parvine și unde' }).click();
  await page.waitForURL('**/account#notifications');

  const reminders = page.getByRole('group', { name: 'Mementouri' });
  await reminders.getByLabel('Prin e-mail').uncheck();
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await expect(page.getByText('Profil salvat')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('group', { name: 'Mementouri' }).getByLabel('Prin e-mail')).not.toBeChecked();
  await expect(page.getByRole('group', { name: 'Mementouri' }).getByLabel('În aplicație')).toBeChecked();
});

/**
 * One save carrying a switch and a new interface language: the preferences must be written before the profile, whose
 * write ends in a navigation — reversed, the switch would be lost without a word (task 52's close review). And the
 * language is remembered, not only navigated to: a bare address afterwards opens in it (OQ-32's cookie).
 */
test('a new interface language reloads the screen in it, keeps a switch saved with it, and is remembered', async ({ page }) => {
  await signedIn(page, 'language');
  await page.goto('/account');

  await page.getByRole('group', { name: 'Mementouri' }).getByLabel('Prin e-mail').uncheck();
  await page.getByRole('combobox', { name: 'Limba interfeței' }).click();
  await page.getByRole('option', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Salvați modificările' }).click();

  await page.waitForURL('**/en/account');
  await expect(page.getByRole('heading', { level: 1, name: 'Profile and preferences' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Interface language' })).toHaveText(/English/);
  await expect(page.getByRole('group', { name: 'Reminders' }).getByLabel('By email')).not.toBeChecked();

  await page.goto('/home');
  await page.waitForURL('**/en/home');
});
