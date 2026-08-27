import { expect, test } from '@playwright/test';
import { cleanupAccounts, verificationTokenFor } from './support/db';

/**
 * Task 20's stated deliverable, literally: **a user registers and verifies from the browser.**
 *
 * The journey runs in Romanian — the source locale — through the shipped screens against the
 * real api and database: register on S-01, land on S-02's challenge with the address stated,
 * fetch the token the way the api e2e does (from the outbox row, as `esg_worker` — no worker
 * process runs, because the token exists the moment registration commits, P-8), follow the
 * link shape the email would carry, and confirm with the explicit button the mail-scanner
 * defence requires (task 19).
 */
const RUN_PREFIX = `e2e-web-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

test.afterAll(async () => {
  await cleanupAccounts(RUN_PREFIX);
});

test('a user registers and verifies from the browser (UC-01, UC-03)', async ({ page }) => {
  const email = addressFor('happy');

  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Creați-vă contul' })).toBeVisible();

  // The policy is displayed before entry (S-02 §5) and answers itself while typing.
  await expect(page.getByText('încă neîndeplinit —').or(page.getByText('Între 8 și 128 de caractere'))).toBeVisible();

  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await expect(page.getByText('— îndeplinit').first()).toBeAttached();

  await page.getByRole('button', { name: 'Creați contul' }).click();

  // S-01 exits to the S-02 challenge, which states the address the link went to.
  await page.waitForURL('**/verify');
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retrimiteți linkul' })).toBeDisabled();

  // The link the email would carry (built by the worker as /{locale}/verify?token=…).
  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);

  // Arrival must not consume the token; the explicit action does.
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mergeți la autentificare' })).toHaveAttribute(
    'href',
    /\/sign-in$/,
  );
});

test('a spent link explains itself and offers the resend route (S-02 error state)', async ({
  page,
}) => {
  const email = addressFor('spent');

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');

  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();

  // Second use of a single-use link: the api's resolved three-part wording, as received.
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Linkul de confirmare nu mai este valabil', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cereți un link nou' })).toBeVisible();
});

test('a duplicate registration surfaces the 409 with sign-in as the way out (OQ-53)', async ({
  page,
}) => {
  const email = addressFor('duplicate');

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();

  // The api's resolved wording, rendered as received — never re-derived from the slug.
  await expect(page.getByText('Există deja un cont pentru această adresă', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Autentificați-vă' }).first()).toBeVisible();
});

test('the language switcher reaches the same screen in all three locales (UX-4)', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByRole('button', { name: /Limba interfeței/ }).click();
  await page.getByRole('menuitem', { name: 'Русский' }).click();
  await page.waitForURL('**/ru/register');
  await expect(page.getByRole('heading', { name: 'Создайте свой аккаунт' })).toBeVisible();

  await page.getByRole('button', { name: /Язык интерфейса/ }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await page.waitForURL('**/en/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  // …and back to the source locale, which is served UNPREFIXED (localePrefix 'as-needed').
  // Asserted through the switcher rather than by navigation, because the switcher builds its
  // hrefs from next-intl's Link and is the surface that would silently reintroduce `/ro`.
  await page.getByRole('button', { name: /Interface language/ }).click();
  await page.getByRole('menuitem', { name: 'Română' }).click();
  await page.waitForURL((url) => url.pathname === '/register');
  await expect(page.getByRole('heading', { name: 'Creați-vă contul' })).toBeVisible();
});
