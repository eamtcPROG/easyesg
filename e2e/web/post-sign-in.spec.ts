import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * §4.3's post-sign-in branch in a real browser (FR-12, UC-16; task 25.4).
 *
 * The whole task is one decision with three arms, and the arms differ only in what the database
 * holds — which is why this suite seeds memberships directly: no route creates one yet (task 29
 * founds an organization, task 26.2 accepts an invitation). What it asserts is the **address the
 * browser ends on**, because that is the deliverable; every destination is still a stub screen
 * (S-04 is task 30.2, S-05 is 30.5), so asserting on content would be asserting on `null`.
 *
 * `post-sign-in.spec.ts` in `apps/web` proves the same rule as a function, arm by arm. This proves
 * the wiring: that sign-in reads real memberships and honours the decision, through the shipped
 * screens against the real api and database.
 */
const RUN_PREFIX = `e2e-web-branch-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

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

async function signIn(page: Page, email: string, returnTo?: string): Promise<void> {
  await page.goto(returnTo ? `/sign-in?return=${encodeURIComponent(returnTo)}` : '/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
}

/** The "none" arm — a verified account that has not created or joined anything (S-04, UC-49). */
test('a member of nothing is sent to create an organization', async ({ page }) => {
  const email = addressFor('none');
  await registerAndVerify(page, email);
  await signIn(page, email);

  await page.waitForURL('**/create-organization');
});

/** The "one" arm. Both "one" and "several" land on S-05; the switcher chooses (OQ-6). */
test('a member of one organization is sent to home', async ({ page }) => {
  const email = addressFor('one');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership(email, `${RUN_PREFIX} Alpha`));
  await signIn(page, email);

  await page.waitForURL('**/home');
});

/**
 * UX-38's deep link, honoured — because exactly one organization resolves, so the destination can
 * actually render. This is the case task 22's interim already handled, kept working.
 */
test('a deep link is honoured when one organization resolves', async ({ page }) => {
  const email = addressFor('return-honoured');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership(email, `${RUN_PREFIX} Beta`));
  await signIn(page, email, '/reports');

  await page.waitForURL('**/reports');
});

/**
 * The same deep link, refused — and this is the behaviour task 25.4 changed. Task 22's interim
 * returned everyone to `?return=`; a member of nothing sent to `/reports` lands on a screen that
 * cannot render without an organization, so the branch wins and they go to S-04 instead.
 */
test('a deep link is overridden when no organization resolves', async ({ page }) => {
  const email = addressFor('return-overridden');
  await registerAndVerify(page, email);
  await signIn(page, email, '/reports');

  await page.waitForURL('**/create-organization');
});
