import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedOpenPeriod,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { enrolFactor, presentPassword } from './support/second-factor';

/**
 * The automated half of NFR-75's verification (architecture.md §12.1 pins @axe-core/playwright
 * for exactly this), on the first real screens. WCAG 2.2 AA is the target; axe automates the
 * machine-checkable part and the manual keyboard/screen-reader audit remains the other half.
 *
 * All three locales on the register screen: the axe pass is mostly locale-independent, but
 * `lang` correctness and accessible names are precisely what varies.
 */
// `/` is the `(public)` chrome (task 74.1) — worth the three locales for the same reason the
// register screen gets them: `lang` correctness and accessible names are exactly what varies. It
// **has** a `<main>` since task 103, which gave the address §8.1's `error — not yet available`
// state in a `FocusColumn` rather than the blank page it used to return.
const SCREENS = ['/', '/en', '/ru', '/register', '/en/register', '/ru/register', '/verify'];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * UX-99's landmark structure, which the tag list above cannot see (added 9 Sep 2026).
 *
 * `landmark-one-main` is in axe's **best-practice** set rather than under a WCAG success criterion,
 * so `WCAG` excludes it — and a screen with chrome and no `main` is exactly what UX-99 forbids and
 * what 2.4.1's bypass-blocks technique needs. It is run as its own pass rather than by adding
 * `best-practice` to the tags, because that tag turns on a few dozen unrelated rules at once and
 * `CLAUDE.md`'s rule is to fix the sites first and then turn the gate on — this one is targeted at
 * the sites this change fixed.
 *
 * **It catches both signs of the defect**: none, which is what the wizard had, and more than one,
 * which is what a `<main>` added to `IndexShell` or `RecordShell` would produce, those rendering
 * inside a `(workspace)` layout that already supplies it.
 */
const LANDMARK_RULES = ['landmark-one-main', 'landmark-unique'];

/**
 * **Empty since 10 Sep 2026, and the mechanism is kept rather than deleted.**
 *
 * `/`, `/en` and `/ru` were exempt while the `(public)` body was blank. Task 103 gave the address a
 * `main` — §8.1's `error — not yet available` state, drawn in a `FocusColumn` — so all three now
 * take the landmark pass with every other screen, and the loop below produces no tests because
 * nothing is exempt.
 *
 * **The exemption failed exactly as designed, seven tasks late.** Its docblock predicted that a
 * screen gaining a `main` would fail here *"the day it does"*, and it did — the day the suite next
 * ran, which was not the day task 103 shipped. It named task 74.3 as the cause and task 103 was;
 * the mechanism did not care which, and that is the property worth keeping. The set stays so the
 * next exemption is asserted rather than declared.
 */
const NO_MAIN_YET = new Set<string>();

const scan = async (page: Page, options: { readonly landmarks?: boolean } = {}) => {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
  if (options.landmarks === false) return;
  const landmarks = await new AxeBuilder({ page }).withRules(LANDMARK_RULES).analyze();
  expect(landmarks.violations).toEqual([]);
};

for (const screen of SCREENS) {
  test(`axe finds no violations on ${screen}`, async ({ page }) => {
    await page.goto(screen);
    await scan(page, { landmarks: !NO_MAIN_YET.has(screen) });
  });
}

/**
 * **The exemption is asserted, not just declared** (gate-integrity review, 9 Sep 2026).
 *
 * `NO_MAIN_YET` was a list with no complement: adding `/register` to it silently narrowed the check
 * and the suite stayed green — the same move the root `CLAUDE.md` names for `.first()` locators,
 * *"resolved it locally and made the defect permanently invisible"*. And its docblock claimed the
 * exemption *"expires by being read"*, which is the one property `LOCK_GUARD_EXEMPT_TABLES` and
 * `APP_IMMUTABLE_COLUMNS` both refuse to rely on: there the complement is computed, and every table
 * or column is accounted for by one list or the other.
 *
 * This closes both directions at once, and both have now fired. A screen that gains a `main` fails
 * here the day it does — task 103 gave `/` one and these three tests went red on the next run — and
 * a screen added to the set to quieten a real failure fails immediately.
 */
for (const screen of NO_MAIN_YET) {
  test(`${screen} is exempt from the landmark pass because it genuinely has no main`, async ({ page }) => {
    await page.goto(screen);
    await page.waitForLoadState('networkidle');
    const landmarks = await new AxeBuilder({ page }).withRules(LANDMARK_RULES).analyze();
    expect(landmarks.violations.map((violation) => violation.id)).toContain('landmark-one-main');
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
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
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
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
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
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
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

/**
 * S-13's Record (task 30.4.3) — the first screen carrying a **Combobox** and the first with
 * repeating sub-collections.
 *
 * Both are shapes axe has something to say about that no earlier screen presented: a control whose
 * ARIA is this codebase's rather than a library's (Radix publishes no combobox), and `fieldset`
 * groups whose legends are the only thing distinguishing "Name" on site one from "Name" on site
 * two. The Index is covered by the `entities` journey's own assertions; this is the composition.
 */
test('axe finds no violations on the entity record', async ({ page }) => {
  const email = `${RUN_PREFIX}-entity@example.md`;

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
    await grantMembership({ email, organizationName: `${RUN_PREFIX}-entity-org` }),
  );

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  await page.goto('/entities/new');
  await page.getByRole('button', { name: 'Adăugați un amplasament' }).click();
  await page.getByRole('button', { name: 'Adăugați o filială' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await scan(page);

  // And the combobox open, which is where its roles actually exist in the DOM.
  await page.getByLabel(/Activitățile entității/).fill('brutarie');
  await expect(page.getByRole('option').first()).toBeVisible();
  await scan(page);
});

/**
 * S-05 (tasks 30.5, 32.4) — the screen every sign-in lands on, and the richest composition axe
 * judges: a `banner`, a `navigation`, a `main`, and four `Panel` regions with their own headings
 * over UX-6's three questions.
 *
 * **It is scanned with filings, not empty**, which is task 32.4's addition and not a detail. The
 * empty screen is one `EmptyState` and a list of memberships; the populated one is where the
 * status chips, the overdue marker and a link per row live — and a status chip is exactly the
 * shape UX-102 is about, a colour whose meaning must also be in words. Scanning the empty version
 * would have judged the screen the least interesting way it renders.
 */
test('axe finds no violations on the home screen', async ({ page }) => {
  const email = `${RUN_PREFIX}-home@example.md`;

  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-home-org`,
  });
  organizations.push(organizationId);
  // One filing in progress with a deadline behind it, and one nobody has started — between them
  // they render every region and every chip S-05 can draw.
  await seedReport({
    organizationId,
    name: `${RUN_PREFIX}-Brutăria`,
    fiscalYear: 2024,
    dueDate: '2025-04-30',
  });
  await seedOpenPeriod({ organizationId, name: `${RUN_PREFIX}-Moara`, fiscalYear: 2025 });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // **Each of the three things the docblock claims this scan covers, named.** A guard on the resume
  // region alone would let `seedOpenPeriod` silently produce nothing and leave the *not started*
  // chip and its link unscanned, with axe passing on a screen that never rendered them.
  await expect(page.getByRole('heading', { name: 'Unde ați rămas' })).toBeVisible();
  await expect(page.getByText('Neînceput').first()).toBeVisible();
  await expect(page.getByText('Termen depășit').first()).toBeVisible();
  await scan(page);
});

test('axe finds no violations on the credentials screen', async ({ page }) => {
  const email = `${RUN_PREFIX}-credentials@example.md`;

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
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
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
