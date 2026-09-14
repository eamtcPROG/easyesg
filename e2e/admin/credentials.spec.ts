import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  OPERATOR_ROLE,
  cleanupOperators,
  lockOperator,
  provisionOperator,
  type OperatorRole,
} from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * Task 151's journeys — A-19, the operator's own credentials, and A-01's recovery sign-in — against the
 * built console, cross-origin, through the routes task 144 built (UC-212, FR-80). What only a browser
 * run can prove is what each unit spec mocks: that the account menu reaches the screen for both
 * privilege levels; that codes issued here sign the operator in on A-01 and land them back here with
 * the count, whatever `?redirect=` carried; that a locked account's refusal leads to the same step and
 * the recovery releases the lock; that a re-enrolment changes which authenticator the next sign-in
 * asks for; and that a password change ends the other sessions and not this one.
 */
const RUN_PREFIX = `e2e-credentials-${process.pid}-${Date.now()}`;
const emailFor = (label: string) => `${RUN_PREFIX}-${label}@easyesg.md`;
const PASSWORD = 'Parola123!';
const NEW_PASSWORD = 'ParolaNoua456!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.afterAll(async () => {
  await cleanupOperators(RUN_PREFIX);
});

const provision = (email: string, role: OperatorRole = OPERATOR_ROLE.PLATFORM_ADMINISTRATOR) =>
  provisionOperator({ email, password: PASSWORD, totpSecret: TOTP_SECRET, role });

const accountMenu = (page: Page, email: string) =>
  page.getByRole('button', { name: `Contul dumneavoastră: ${email}` });

const section = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

const gate = (page: Page) => page.getByLabel('Parola actuală', { exact: true });

/** A-01's credential step, from wherever the page is. */
async function submitCredential(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Continuați' }).click();
}

/**
 * A full handshake spends **two** of the five attempts §12.5.6 allows an address per quarter hour — the
 * challenge and the factor each count, successes included — so a journey here has room for two sign-ins
 * and one more step. The window is task 144's api e2e to prove, not these journeys' to drain.
 */
async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await submitCredential(page, email);
  await expect(page.getByRole('heading', { name: 'Confirmați al doilea factor' })).toBeVisible();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(TOTP_SECRET));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
}

async function signOut(page: Page, email: string) {
  await accountMenu(page, email).click();
  await page.getByRole('menuitem', { name: 'Ieșiți din consolă' }).click();
  await page.waitForURL('**/sign-in');
}

async function openCredentials(page: Page, email: string) {
  await accountMenu(page, email).click();
  await page.getByRole('menuitem', { name: 'Datele de autentificare' }).click();
  await page.waitForURL('**/credentials');
  await expect(page.getByRole('heading', { level: 1, name: 'Datele de autentificare' })).toBeVisible();
}

/** A-01's third step, filled and sent. */
async function recoverWith(page: Page, email: string, code: string) {
  await expect(page.getByRole('heading', { name: 'Intrați cu un cod de recuperare' })).toBeVisible();
  // Prefilled from whichever way in, and never through the address bar.
  await expect(page.getByLabel('Adresa de e-mail')).toHaveValue(email);
  expect(page.url()).not.toContain(encodeURIComponent(email));
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Cod de recuperare').fill(code);
  await page.getByRole('button', { name: 'Intrați în consolă' }).click();
}

/** Issue a set on A-19 and return it, as the operator would copy it down. */
async function issueCodes(page: Page): Promise<string[]> {
  const codes = section(page, 'Coduri de recuperare');
  await gate(page).fill(PASSWORD);
  await codes.getByRole('button', { name: /^Emiteți/ }).click();
  const list = codes.getByRole('list', { name: 'Codurile de recuperare' });
  await expect(list.getByRole('listitem')).toHaveCount(10);
  const issued = (await list.getByRole('listitem').allTextContents()).map((code) => code.trim());
  await codes.getByRole('button', { name: 'Le-am păstrat' }).click();
  await expect(codes.getByText(/^10 coduri nefolosite/)).toBeVisible();
  return issued;
}

test('codes issued on A-19 sign the operator in from the factor step, back on A-19 with the count (UC-212)', async ({
  page,
}) => {
  const email = emailFor('recovery');
  provision(email);
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await openCredentials(page, email);

  // Empty — first use: this screen is the only thing that mints a set.
  await expect(
    section(page, 'Coduri de recuperare').getByText('Nu ați emis încă niciun set de coduri de recuperare'),
  ).toBeVisible();
  const [code] = await issueCodes(page);
  await signOut(page, email);

  // Headed somewhere else — and a recovery sign-in lands on A-19 all the same (A-01's exits).
  await page.goto('/organizations');
  await page.waitForURL('**/sign-in?*redirect=*');
  await submitCredential(page, email);
  await expect(page.getByRole('heading', { name: 'Confirmați al doilea factor' })).toBeVisible();
  await page.getByRole('button', { name: 'Folosiți un cod de recuperare' }).click();
  await recoverWith(page, email, code);

  await page.waitForURL('**/credentials?notice=recovered');
  await expect(page.getByText('Ați intrat cu un cod de recuperare')).toBeVisible();
  await expect(page.getByText('V-au mai rămas 9 coduri nefolosite.', { exact: false })).toBeVisible();
  await expect(section(page, 'Coduri de recuperare').getByText(/^9 coduri nefolosite/)).toBeVisible();
});

test('a locked operator reaches the recovery step from the lockout refusal, and the recovery releases the lock', async ({
  page,
}) => {
  const email = emailFor('locked');
  provision(email);
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await openCredentials(page, email);
  const [, code] = await issueCodes(page);
  await signOut(page, email);
  await lockOperator(email);

  await submitCredential(page, email);
  const refusal = page.getByRole('alert');
  await expect(refusal).toContainText('Cont de operator blocat');
  // A locked account never reaches the factor step, so the refusal carries the way in.
  await refusal.getByRole('button', { name: 'Intrați cu un cod de recuperare' }).click();
  await recoverWith(page, email, code);
  await page.waitForURL('**/credentials?notice=recovered');

  // Released, not bypassed: the ordinary handshake admits the account again.
  await signOut(page, email);
  await signIn(page, email);
  await page.waitForURL('**/organizations');
});

test('a re-enrolment takes the password once across its two steps, and the next sign-in asks the new authenticator', async ({
  page,
}) => {
  const email = emailFor('reenrol');
  provision(email);
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await openCredentials(page, email);

  const factor = section(page, 'Al doilea factor');
  await gate(page).fill(PASSWORD);
  await factor.getByRole('button', { name: 'Configurați o aplicație nouă' }).click();
  // The Enrolment code's typed secret — the path a desktop authenticator takes, and this suite's.
  const secret = factor.locator('[translate="no"]');
  await expect(secret).toBeVisible();
  const newSecret = ((await secret.textContent()) ?? '').trim();
  expect(newSecret).not.toBe(TOTP_SECRET);
  // Typed once: the confirming step asks for the same password, and the field still holds it.
  await expect(gate(page)).toHaveValue(PASSWORD);

  await factor.getByLabel('Cod de verificare din aplicația nouă').fill(currentTotpCode(newSecret));
  await factor.getByRole('button', { name: 'Activați aplicația nouă' }).click();
  await expect(factor.getByText('Aplicația nouă de autentificare este activă')).toBeVisible();
  await expect(gate(page)).toHaveValue('');

  // The authenticator that was in force no longer signs in…
  await signOut(page, email);
  await signIn(page, email);
  await expect(page.getByText('Cod de verificare incorect')).toBeVisible();
  // …and the new one does.
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(newSecret));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
  await page.waitForURL('**/organizations');
});

test('a password change ends the operator’s other sessions and keeps this one', async ({ page, browser }) => {
  const email = emailFor('password');
  provision(email);
  const elsewhereContext = await browser.newContext(test.info().project.use);
  const elsewhere = await elsewhereContext.newPage();

  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await signIn(elsewhere, email);
  await elsewhere.waitForURL('**/organizations');

  await openCredentials(page, email);
  const password = section(page, 'Parolă');
  await gate(page).fill(PASSWORD);
  await password.getByLabel('Parola nouă', { exact: true }).fill(NEW_PASSWORD);
  await password.getByLabel('Închideți celelalte sesiuni ale contului').check();
  await password.getByRole('button', { name: 'Schimbați parola' }).click();
  await expect(password.getByText('Parola a fost schimbată')).toBeVisible();
  await expect(password.getByText('1 altă sesiune a contului a fost închisă', { exact: false })).toBeVisible();

  // The other session is gone: its next arrival meets the closed realm…
  await elsewhere.goto('/organizations');
  await elsewhere.waitForURL('**/sign-in?*redirect=*');
  await elsewhereContext.close();
  // …and this one stays.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Datele de autentificare' })).toBeVisible();

  // The new password is what the credential step now accepts — where a password is judged. The factor
  // step is not taken: the two sign-ins above spent four attempts of this address's window, and this
  // challenge is the fifth (see `signIn`).
  await signOut(page, email);
  await submitCredential(page, email, NEW_PASSWORD);
  await expect(page.getByRole('heading', { name: 'Confirmați al doilea factor' })).toBeVisible();
});

test('a Billing Operator reaches A-19 from the account menu too', async ({ page }) => {
  const email = emailFor('billing');
  provision(email, OPERATOR_ROLE.BILLING_OPERATOR);
  await signIn(page, email);
  await page.waitForURL('**/billing/reconciliation');

  await openCredentials(page, email);
  await expect(
    section(page, 'Coduri de recuperare').getByText('Nu ați emis încă niciun set de coduri de recuperare'),
  ).toBeVisible();
});

test('axe finds no violations on A-19 with a re-enrolment open, nor on A-01’s recovery step', async ({
  page,
}) => {
  const email = emailFor('axe');
  provision(email);
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await openCredentials(page, email);

  const factor = section(page, 'Al doilea factor');
  await gate(page).fill(PASSWORD);
  await factor.getByRole('button', { name: 'Configurați o aplicație nouă' }).click();
  await expect(factor.getByLabel('Cod de verificare din aplicația nouă')).toBeVisible();
  await expect(
    section(page, 'Coduri de recuperare').getByText('Nu ați emis încă niciun set de coduri de recuperare'),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);

  await signOut(page, email);
  await submitCredential(page, email);
  await page.getByRole('button', { name: 'Folosiți un cod de recuperare' }).click();
  await expect(page.getByRole('heading', { name: 'Intrați cu un cod de recuperare' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations).toEqual([]);
});
