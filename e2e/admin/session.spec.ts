import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator, type OperatorRole } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * Task 23's stated deliverable, literally: **admin sign-in/out e2e through the public
 * surface** — the console as an ordinary, cross-origin client of the one API (DR-11, AD-9,
 * OQ-17), TOTP challenged on every sign-in (FR-75), as A-01's two-step handshake since the
 * 24 Aug 2026 review: the credential opens a sealed five-minute challenge, the factor screen
 * names the server-verified address, the code completes it.
 *
 * The journey runs against the built console bundle on its own origin, so the whole §12.5.6
 * posture is exercised for real: CORS with credentials, the `SameSite=Strict` cookie flowing
 * same-site cross-origin, the Origin proof on the sign-in POST. What the browser never holds,
 * asserted from inside it: no token, no readable session cookie.
 *
 * **Task 67.1 puts the chrome in the journey.** Sign-out goes through the account menu rather than
 * task 23's strip; the root answers with the home for the operator's privilege level; and a Billing
 * Operator is proven to land on A-10 under their own realm's label with no navigation drawn — the
 * chrome carries what renders, and nothing behind the realm renders yet.
 */
const RUN_PREFIX = `e2e-admin-${process.pid}-${Date.now()}`;
const emailFor = (label: string) => `${RUN_PREFIX}-${label}@easyesg.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test.afterAll(async () => {
  await cleanupOperators(RUN_PREFIX);
});

/** UC-68 step one, through the screen. */
async function beginSignIn(page: Page, email: string) {
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuați' }).click();
  // The factor step names the address the SERVER verified — the handshake's point.
  await expect(page.getByRole('heading', { name: 'Confirmați al doilea factor' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
}

async function signIn(page: Page, email: string, code = currentTotpCode(TOTP_SECRET)) {
  await beginSignIn(page, email);
  await page.getByLabel('Cod de verificare').fill(code);
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
}

const provision = (email: string, role: OperatorRole) =>
  provisionOperator({ email, password: PASSWORD, totpSecret: TOTP_SECRET, role });

/** The chrome's banner, by the name the console gives it. */
const consoleBar = (page: Page) => page.getByRole('banner', { name: 'Consola de administrare' });

/** The account corner's trigger, named by its label and the address (WCAG 2.5.3). */
const accountMenu = (page: Page, email: string) =>
  page.getByRole('button', { name: `Contul dumneavoastră: ${email}` });

test('the realm is closed by default, admits credential + code, and signs out (UC-68)', async ({
  page,
}) => {
  const email = emailFor('happy');
  provision(email, OPERATOR_ROLE.PLATFORM_ADMINISTRATOR);

  // Closed by default: the guarded screen bounces to A-01 with the destination carried.
  await page.goto('/organizations');
  await page.waitForURL('**/sign-in?*redirect=*');
  await expect(page.getByRole('heading', { name: 'Autentificare operator' })).toBeVisible();

  await signIn(page, email);

  // …and returns where the operator was headed (the console's UX-38).
  await page.waitForURL('**/organizations');
  // The chrome (task 67.1): the bar names the realm, the account corner carries the address.
  await expect(consoleBar(page)).toContainText('Administrator de platformă');
  await expect(accountMenu(page, email)).toBeVisible();

  // OQ-17's whole point, from inside the browser: nothing readable holds the session.
  const readable = await page.evaluate(() => document.cookie);
  expect(readable).not.toContain('easyesg_admin_session');

  // The root answers with this operator's home — A-02 for a Platform Administrator (task 67.1).
  await page.goto('/');
  await page.waitForURL('**/organizations');

  await accountMenu(page, email).click();
  await page.getByRole('menuitem', { name: 'Ieșiți din consolă' }).click();
  await page.waitForURL('**/sign-in');

  // The session ended server-side too: the realm is closed again.
  await page.goto('/organizations');
  await page.waitForURL('**/sign-in?*redirect=*');
});

/**
 * **The gate runs in the other direction too** (task 113; UX-136, §5.2's A-01 entry points).
 *
 * `_realm` has turned an unauthenticated arrival away since task 23 and nothing did the reverse, so
 * an operator holding a live session who typed this address, followed a bookmark or pressed back was
 * served the form — and submitting it re-ran the whole handshake and rotated the sealed cookie
 * underneath a session that was working. The test above proves the closed direction; this proves the
 * open one, **by address**, which is the only way it can be entered.
 */
test('a live session is turned away from A-01, to the destination the address asked for', async ({
  page,
}) => {
  const email = emailFor('held');
  provision(email, OPERATOR_ROLE.PLATFORM_ADMINISTRATOR);

  await page.goto('/sign-in');
  await signIn(page, email);
  await page.waitForURL('**/organizations');

  // Typed, bookmarked, or arrived at by the back button: the form is not served to a live session.
  await page.goto('/sign-in');
  await page.waitForURL('**/organizations');
  await expect(consoleBar(page)).toBeVisible();

  // A same-app `?redirect=` still wins over the home — A-01's own exit rule, rather than a second
  // rule about where an operator belongs written three lines away from the first.
  await page.goto('/sign-in?redirect=%2Faccounts');
  await page.waitForURL('**/accounts');

  // And the arrival notice buys no exemption. It is in the address, so a carve-out on it would be a
  // way back to the form that anyone could write into a link (§12.5.6's task-113 row).
  await page.goto('/sign-in?notice=invitation-accepted');
  await page.waitForURL('**/organizations');
});

/**
 * **The half that makes the gate above safe to have**, and the reason it is a journey rather than a
 * unit case: it needs a warm console whose session dies underneath it.
 *
 * Six sections navigate here when their own read answers 401, and until task 113 none of them told
 * `adminSessionQuery` what they had just learned — so the console went on believing it was signed in
 * for the rest of that entry's minute. Harmless while A-01 served the form to anyone; with a gate on
 * A-01 the stale answer sends the operator straight back to the screen that had refused them, which
 * refuses them again, without end. What fails here if the recording is dropped is not an assertion
 * about a cache: it is that A-01 never renders at all.
 */
test('a read that finds the session gone reaches A-01 rather than bouncing off it', async ({
  page,
  context,
}) => {
  const email = emailFor('lapsed');
  provision(email, OPERATOR_ROLE.PLATFORM_ADMINISTRATOR);

  await page.goto('/sign-in');
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await expect(page.getByRole('heading', { level: 1, name: 'Organizații' })).toBeVisible();

  // The session ends server-side while the console's own answer is still cached as signed-in; the
  // search is what asks the api again without reloading the page, which would refill that cache.
  await context.clearCookies();
  await page.getByLabel('Căutați după nume sau IDNO').fill('sesiune-încheiată');
  await page.getByRole('button', { name: 'Căutați', exact: true }).click();

  await page.waitForURL('**/sign-in?*redirect=*');
  await expect(page.getByRole('heading', { name: 'Autentificare operator' })).toBeVisible();
});

test('a wrong code refuses distinctly and the challenge survives for the retype', async ({
  page,
}) => {
  const email = emailFor('factor');
  provision(email, OPERATOR_ROLE.PLATFORM_ADMINISTRATOR);

  await page.goto('/sign-in');
  await signIn(page, email, '000000');

  // The api's resolved wording, as received — and the flow STAYS on the factor step: A-01's
  // "failed factor" is recoverable, so the retyped code completes the same challenge.
  await expect(page.getByText('Cod de verificare incorect')).toBeVisible();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(TOTP_SECRET));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
  await page.waitForURL('**/organizations');
});

test('a Billing Operator lands on A-10, under their own realm, with no navigation drawn', async ({
  page,
}) => {
  const email = emailFor('billing');
  provision(email, OPERATOR_ROLE.BILLING_OPERATOR);

  // Signed out, the root carries no destination: which home is right depends on who signs in.
  await page.goto('/');
  await page.waitForURL('**/sign-in');
  await signIn(page, email);

  // A-01's exit for this privilege level (design_spec.md §5.2, task 67.1).
  await page.waitForURL('**/billing/reconciliation');
  await expect(consoleBar(page)).toContainText('Operator de facturare');
  await expect(accountMenu(page, email)).toBeVisible();
  // The chrome carries what renders: no console screen has shipped, so there is no navigation to
  // draw. Task 67.3 turns this into a platform section when A-02 lands — for a PA only.
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('axe finds no violations on the console chrome', async ({ page }) => {
  const email = emailFor('axe');
  provision(email, OPERATOR_ROLE.PLATFORM_ADMINISTRATOR);

  await page.goto('/sign-in');
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await expect(consoleBar(page)).toBeVisible();
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);

  // The chrome is where the realm's landmarks come from: one banner at the top level, one main for
  // the screen to render into — best-practice rules the tags above do not select.
  const landmarks = await new AxeBuilder({ page })
    .withRules(['landmark-one-main', 'landmark-unique', 'landmark-banner-is-top-level'])
    .analyze();

  expect(landmarks.violations).toEqual([]);
});

test('axe finds no violations on A-01', async ({ page }) => {
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(results.violations).toEqual([]);

  // UX-99's landmark structure, which those tags cannot see: `landmark-one-main` is axe's
  // **best-practice** set (added 9 Sep 2026, with the tenant scan's). A-01 is `FocusShell`, which
  // composes `FocusColumn` and so carries the landmark already — this asserts it rather than
  // assuming it, and guards the duplicate the route fallbacks could introduce, each rendering a
  // `<main>` of its own inside whatever layout was matched when they fire.
  const landmarks = await new AxeBuilder({ page })
    .withRules(['landmark-one-main', 'landmark-unique'])
    .analyze();

  expect(landmarks.violations).toEqual([]);
});
