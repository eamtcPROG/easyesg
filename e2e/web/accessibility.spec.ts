import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, verificationTokenFor } from './support/db';
import { enrolFactor, presentPassword } from './support/second-factor';

/**
 * The automated half of NFR-75's verification (architecture.md §12.1 pins @axe-core/playwright
 * for exactly this), on the first real screens. WCAG 2.2 AA is the target; axe automates the
 * machine-checkable part and the manual keyboard/screen-reader audit remains the other half.
 *
 * All three locales on the register screen: the axe pass is mostly locale-independent, but
 * `lang` correctness and accessible names are precisely what varies.
 */
const SCREENS = ['/register', '/en/register', '/ru/register', '/verify'];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const scan = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
};

for (const screen of SCREENS) {
  test(`axe finds no violations on ${screen}`, async ({ page }) => {
    await page.goto(screen);
    await scan(page);
  });
}

/**
 * S-16, which is a different kind of screen and therefore a different kind of scan (task 26.4).
 *
 * Every screen above is a Focus form: labels, a summary, one primary action. S-16 is the first
 * **Index** — a sortable table, status chips, two filter selects and a form, which between them
 * exercise the rules the identity screens never reach: table header semantics, `aria-sort`, a
 * control whose only label is visually hidden, and colour that must not be the sole carrier of a
 * state. It is also the first screen behind a session, so it costs a sign-in to reach.
 */
const RUN_PREFIX = `e2e-web-axe-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

test('axe finds no violations on the users and access screen', async ({ page }) => {
  const email = `${RUN_PREFIX}@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-org` }),
  );

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  await page.goto('/organization/users');
  await expect(page.getByRole('heading', { name: 'Utilizatori și acces', level: 1 })).toBeVisible();
  await scan(page);
});

test('axe finds no violations on the credentials screen', async ({ page }) => {
  const email = `${RUN_PREFIX}-credentials@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-cred-org` }),
  );

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  await page.goto('/account/credentials');
  // Three labelled regions and one h1 — the Record archetype's structure is most of what axe
  // has to judge here, and it is the part a screen gets wrong invisibly.
  await expect(page.getByRole('heading', { name: 'Date de autentificare', level: 1 })).toBeVisible();
  await scan(page);
});

/**
 * S-01's staged factor step (task 27.8) — scanned because `CodeField` is a shape axe has something
 * to say about and no other screen presents at rest.
 *
 * The control is **one** `<input>` behind `aria-hidden` painted cells (task 27.4, UX-108): six
 * separate boxes would each need a name, would fight every password manager, and would fail
 * 3.3.8's "no cognitive function test" the moment a reader had to track which box they were in.
 * That decision is only sound if the single input is properly labelled and described, which is
 * precisely what this scan judges — and it costs an enrolment to reach, which is why it is here
 * and not in the loop at the top.
 */
test('axe finds no violations on the second-factor step', async ({ page }) => {
  const email = `${RUN_PREFIX}-factor@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-factor-org` }),
  );

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  // Enrolled and re-presented through `credentials.spec.ts`'s own helpers — the journey is that
  // suite's subject, and a second copy of it here was what made this scan a maintenance liability.
  await enrolFactor(page, { email, password: PASSWORD });
  await presentPassword(page, { email, password: PASSWORD });
  await page.waitForURL('**/sign-in/factor');

  await expect(page.getByRole('heading', { name: 'Confirmați că sunteți dumneavoastră', level: 1 })).toBeVisible();
  await scan(page);

  // The other affordance is a different control entirely — a plain sixteen-character field — and
  // switching to it is the only way axe sees it.
  await page.getByRole('button', { name: /Folosiți un cod de recuperare/ }).click();
  await expect(page.getByLabel('Cod de recuperare')).toBeVisible();
  await scan(page);
});
