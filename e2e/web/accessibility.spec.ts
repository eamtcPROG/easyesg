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

  // Twice, on one sign-in, because the second scan is a different surface (task 30.1). The pass
  // above judges §4.2's global tier at rest — the band is on every authenticated screen, so every
  // scan below this line already includes it. This one judges it **open**: a menu, a submenu, an
  // expanded trigger and the roles that hold them together, none of which exist in the DOM until
  // somebody clicks. A component spec pins the roles; only axe judges them in a real page.
  await page.getByRole('button', { name: `Contul dumneavoastră: ${email}` }).click();
  await expect(page.getByRole('menuitem', { name: 'Date de autentificare' })).toBeVisible();
  await scan(page);
});

/**
 * S-04 (task 30.2) — the first Focus screen **inside** the authenticated shell, which is the
 * reason it is scanned separately from the four at the top.
 *
 * Those are `(identity)` screens: `FocusShell` supplies their banner, main and contentinfo, and
 * they have no other chrome. This one takes `FocusColumn` under the global tier, so it is the
 * composition that has to be judged — one banner from the tier, one main from the column — and it
 * is exactly the pairing task 30.1 got wrong once already, silently, between `RecordShell` and the
 * bar. It also carries the product's first `Select` outside a table.
 */
test('axe finds no violations on the create-organization screen', async ({ page }) => {
  const email = `${RUN_PREFIX}-found@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  // No membership seeded, deliberately: §4.3's *none* arm is this screen's only entry point, and
  // granting one would land the sign-in on `/home` instead.
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/create-organization');

  await expect(page.getByRole('heading', { name: 'Configurați-vă organizația', level: 1 })).toBeVisible();
  await scan(page);
});

/**
 * S-15 (task 30.3) — the Record archetype's second instance, and the first with a *record-level*
 * save rather than per-section commits.
 *
 * What axe has to judge here that S-28 did not present: four `RecordSection` regions under one
 * form, two selects built from configuration, a disabled primary action whose state is also stated
 * in words, and an attribution line that is neither a heading nor a control.
 */
test('axe finds no violations on the organization profile screen', async ({ page }) => {
  const email = `${RUN_PREFIX}-profile@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-profile-org` }),
  );

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  await page.goto('/organization');
  await expect(page.getByRole('heading', { name: 'Profilul organizației', level: 1 })).toBeVisible();
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
