import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  passwordResetTokenFor,
  verificationTokenFor,
} from './support/db';

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

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** UC-01 + UC-03 through the screens, as the registration suite proved them. */
async function registerAndVerify(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

async function signIn(
  page: Page,
  email: string,
  password: string,
  options: { remember?: boolean } = {},
): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(password);
  if (options.remember) {
    await page.getByLabel('Țineți-mă autentificat pe acest dispozitiv').check();
  }
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
}

/** The session cookie as the BROWSER holds it — `expires` is what persistence actually means. */
async function sessionCookie(page: Page) {
  const jar = await page.context().cookies();
  const found = jar.find((c) => c.name === 'easyesg_session');
  expect(found, 'no session cookie was set').toBeDefined();
  return found!;
}

test('a user signs in, holds an httpOnly session, and signs out (UC-04, UC-06)', async ({
  page,
}) => {
  const email = addressFor('happy');
  await registerAndVerify(page, email);

  await signIn(page, email, PASSWORD);

  // §4.3's branch, real since task 25.4: this account belongs to nothing, so it lands on S-04
  // rather than on the home it has no organization to fill.
  await page.waitForURL('**/create-organization');
  // The global tier's account corner names the signed-in address (task 30.1, replacing task 22's
  // interim strip). The band carries no organization region here, which is S-04's own artboard
  // state and `global-tier.spec.ts`'s subject.
  await expect(page.getByRole('button', { name: `Contul dumneavoastră: ${email}` })).toBeVisible();

  // AD-9's whole point, asserted from inside the browser: the session cookie is httpOnly and
  // carries no readable token — browser JavaScript sees nothing of it.
  const readable = await page.evaluate(() => document.cookie);
  expect(readable).not.toContain('easyesg_session');

  // Sign-out lives in the user menu since task 30.1 (§4.2). Two clicks rather than one, and the
  // extra one is the deliverable: §4.2 puts sign-out behind the account corner on every
  // authenticated screen, so a journey that could still reach it directly would mean the interim
  // strip was left behind rather than replaced.
  await page.getByRole('button', { name: `Contul dumneavoastră: ${email}` }).click();
  await page.getByRole('menuitem', { name: 'Ieșiți din cont' }).click();
  await page.waitForURL('**/sign-in');

  // The session is gone server-side too: the guarded route bounces straight back.
  await page.goto('/home');
  await page.waitForURL('**/sign-in?**');
});

/**
 * UX-38's deep-link contract. **The account is given a membership since task 25.4**, and that is
 * the test staying true rather than being adjusted to pass: `?return=` is honoured only where an
 * organization resolves, so without one this would now assert S-04 and prove nothing about the
 * return path. `post-sign-in.spec.ts` owns the override case.
 */
test('a guarded route redirects to sign-in and returns after it (UX-38)', async ({ page }) => {
  const email = addressFor('return');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} Return` }));

  await page.goto('/reports');
  await page.waitForURL('**/sign-in?return=%2Freports');

  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();

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
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');

  await signIn(page, email, PASSWORD);

  await expect(page.getByText('Adresă neconfirmată')).toBeVisible();
  await page.getByRole('link', { name: 'Mergeți la confirmarea adresei' }).click();
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
  await page.getByRole('button', { name: 'Trimiteți linkul' }).click();
  // Uniform: the confirmation asserts only the conditional fact (NFR-64).
  await expect(page.getByText('Cererea a fost înregistrată')).toBeVisible();

  const token = await passwordResetTokenFor(email);
  await page.goto(`/set-password?token=${token}`);

  // P5: the consequence is stated BEFORE it happens.
  await expect(page.getByText('Toate sesiunile existente vor fi închise')).toBeVisible();

  await page.getByLabel('Parola nouă').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Salvați parola nouă' }).click();
  await expect(page.getByText('Parola a fost schimbată')).toBeVisible();

  await page.getByRole('link', { name: 'Mergeți la autentificare' }).click();
  await page.waitForURL('**/sign-in');
  await signIn(page, email, NEW_PASSWORD);
  // No membership, so §4.3 sends them to S-04 — the new password worked, which is the claim.
  await page.waitForURL('**/create-organization');
});

test('a bare set-password arrival explains itself and offers the request route', async ({
  page,
}) => {
  await page.goto('/set-password');
  await expect(page.getByText('Linkul este incomplet')).toBeVisible();
  await page.getByRole('link', { name: 'Cereți un link nou' }).click();
  await page.waitForURL('**/reset');
});

/**
 * S-01's *Keep me signed in on this device* (§12.5.6, OQ-35 amended 4 Sep 2026), across the two
 * halves that have to agree — and they are held by different systems, which is the whole reason
 * this is a browser test rather than two unit tests.
 *
 * The **API** decides the session's lifetime from the `remember` field and answers a
 * `refreshTokenExpiresAt`; the **web tier** decides whether the cookie carries a `Max-Age` at all.
 * A defect in either alone is invisible: a persistent cookie over a 12 h session signs the reader
 * out on their next visit with no explanation, and a session cookie over a 30 d session throws away
 * a month of it the moment the browser closes. Playwright reports `expires === -1` for a
 * browser-session cookie, which is the only place that distinction is observable at all.
 */
test.describe('session persistence (OQ-35)', () => {
  test('declining leaves a cookie that dies with the browser, capped at 12 hours', async ({
    page,
  }) => {
    const email = addressFor('not-remembered');
    await registerAndVerify(page, email);

    await signIn(page, email, PASSWORD);
    await page.waitForURL('**/create-organization');

    const cookie = await sessionCookie(page);
    // -1 is Playwright's spelling of "no expiry attribute" — a browser-session cookie.
    expect(cookie.expires).toBe(-1);
    // Still httpOnly, and still nothing readable: the shorter window changes the lifetime and
    // nothing else about how the session is held.
    expect(cookie.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('easyesg_session');
  });

  test('ticking it persists the cookie, and for the longer window', async ({ page }) => {
    const email = addressFor('remembered');
    await registerAndVerify(page, email);

    await signIn(page, email, PASSWORD, { remember: true });
    await page.waitForURL('**/create-organization');

    const cookie = await sessionCookie(page);
    expect(cookie.expires).toBeGreaterThan(0);

    // **The bound is asserted as a range, not a value.** The clock moves between the API stamping
    // the expiry and this line reading it, so an equality would be flaky by construction — and the
    // claim that matters is which POLICY was applied, which a day's worth of margin settles
    // absolutely: 12 h and 7 days cannot both satisfy it.
    const secondsLeft = cookie.expires - Date.now() / 1000;
    const day = 24 * 60 * 60;
    expect(secondsLeft).toBeGreaterThan(6 * day);
    expect(secondsLeft).toBeLessThanOrEqual(7 * day);
  });
});
