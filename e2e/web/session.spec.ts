import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, passwordResetTokenFor, verificationTokenFor } from './support/db';

/**
 * Task 22's stated deliverable, literally: **browser sign-in/out against the public API** —
 * plus the S-02 reset surfaces whose API task 21 shipped for exactly this screen pair.
 *
 * The journey runs in Romanian through the shipped screens against the real api and database.
 * Tokens are read the way the registration suite reads them — from the outbox row, as
 * `esg_worker`, because the raw token exists nowhere else (OQ-54). What the browser never
 * sees, and this suite proves by omission: no access or refresh token in any URL, and the one
 * cookie is httpOnly — `document.cookie` stays empty of it.
 */
const RUN_PREFIX = `e2e-web-session-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';
const NEW_PASSWORD = 'ParolaNoua456!';

test.afterAll(async () => {
  await cleanupAccounts(RUN_PREFIX);
});

/** UC-01 + UC-03 through the screens, as the registration suite proved them. */
async function registerAndVerify(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creează contul' }).click();
  await page.waitForURL('**/verify');
  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmă adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
}

test('a user signs in, holds an httpOnly session, and signs out (UC-04, UC-06)', async ({
  page,
}) => {
  const email = addressFor('happy');
  await registerAndVerify(page, email);

  await signIn(page, email, PASSWORD);

  // §4.3's membership branch is task 25's; until then sign-in lands on S-05's route.
  await page.waitForURL('**/home');
  await expect(page.getByText(email)).toBeVisible();

  // AD-9's whole point, asserted from inside the browser: the session cookie is httpOnly and
  // carries no readable token — browser JavaScript sees nothing of it.
  const readable = await page.evaluate(() => document.cookie);
  expect(readable).not.toContain('easyesg_session');

  await page.getByRole('button', { name: 'Ieși din cont' }).click();
  await page.waitForURL('**/sign-in');

  // The session is gone server-side too: the guarded route bounces straight back.
  await page.goto('/home');
  await page.waitForURL('**/sign-in?**');
});

test('a guarded route redirects to sign-in and returns after it (UX-38)', async ({ page }) => {
  const email = addressFor('return');
  await registerAndVerify(page, email);

  await page.goto('/reports');
  await page.waitForURL('**/sign-in?return=%2Freports');

  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră în cont' }).click();

  await page.waitForURL('**/reports');
});

test('a wrong password answers the uniform document, as received (NFR-64)', async ({ page }) => {
  const email = addressFor('wrong');
  await registerAndVerify(page, email);

  await signIn(page, email, 'GresitTotal999!');

  // The api's resolved title, rendered untouched — no client-side sentence for a slug.
  await expect(page.getByText('Autentificare nereușită')).toBeVisible();
});

test('a correct password on an unverified account names verification as the blocker (OQ-57)', async ({
  page,
}) => {
  const email = addressFor('unverified');
  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creează contul' }).click();
  await page.waitForURL('**/verify');

  await signIn(page, email, PASSWORD);

  await expect(page.getByText('Adresă neconfirmată')).toBeVisible();
  await page.getByRole('link', { name: 'Mergi la confirmarea adresei' }).click();
  await page.waitForURL('**/verify');
  // The address rode the same hand-off registration uses; the challenge states it.
  await expect(page.getByText(email)).toBeVisible();
});

test('the reset flow: uniform request, stated consequence, new password signs in (UC-08, UC-09)', async ({
  page,
}) => {
  const email = addressFor('reset');
  await registerAndVerify(page, email);

  await page.goto('/reset');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByRole('button', { name: 'Trimite linkul' }).click();
  // Uniform: the confirmation asserts only the conditional fact (NFR-64).
  await expect(page.getByText('Cererea a fost înregistrată')).toBeVisible();

  const token = await passwordResetTokenFor(email);
  await page.goto(`/set-password?token=${token}`);

  // P5: the consequence is stated BEFORE it happens.
  await expect(page.getByText('Toate sesiunile existente vor fi închise')).toBeVisible();

  await page.getByLabel('Parola nouă').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Salvează parola nouă' }).click();
  await expect(page.getByText('Parola a fost schimbată')).toBeVisible();

  await page.getByRole('link', { name: 'Mergi la autentificare' }).click();
  await page.waitForURL('**/sign-in');
  await signIn(page, email, NEW_PASSWORD);
  await page.waitForURL('**/home');
});

test('a bare set-password arrival explains itself and offers the request route', async ({
  page,
}) => {
  await page.goto('/set-password');
  await expect(page.getByText('Linkul este incomplet')).toBeVisible();
  await page.getByRole('link', { name: 'Cere un link nou' }).click();
  await page.waitForURL('**/reset');
});
