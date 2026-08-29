import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * §4.2's global tier in a real browser (UX-2, UX-135; task 30.1).
 *
 * **What only a browser can prove here is the sign-out path.** The band's two renderings and the
 * menu's structure are component specs in `packages/ui` — cheaper, and they cover the states this
 * suite would have to contrive. What they cannot cover is that a submit button rendered inside a
 * Radix portal actually reaches its Server Action. It did not, on the first build: selecting a menu
 * item closes the menu, React unmounts the portal, and the button's own default submission — which
 * runs *after* the handlers — never happened. Nothing errored; the menu closed and the person
 * stayed signed in. This test is what found it and what keeps the explicit `requestSubmit()` in
 * `account-corner.tsx` from being tidied away. `session.spec.ts` drives the same control for the
 * member-of-nothing.
 *
 * The organization is seeded, as it is in `post-sign-in.spec.ts` and for the same reason: this
 * suite is about the chrome, and founding an organization through S-04 is task 30.2's journey.
 */
const RUN_PREFIX = `e2e-web-tier-${process.pid}-${Date.now()}`;
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
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

const accountTrigger = (page: Page, email: string) =>
  page.getByRole('button', { name: `Contul dumneavoastră: ${email}` });

test('the tier names the active organization and carries the account corner (UX-2)', async ({
  page,
}) => {
  const email = addressFor('member');
  const organizationName = `${RUN_PREFIX} Brutăria`;
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName }));

  await signIn(page, email);

  // UX-2: visible at all times, and resolved from the session rather than from the address —
  // `/home` carries no organization segment and never will (AD-2).
  //
  // Scoped to the banner since task 30.5: S-05 names the same organization in its heading and its
  // membership list too, and this test is about the *tier*.
  await expect(page.getByRole('banner').getByText(organizationName)).toBeVisible();
  await expect(accountTrigger(page, email)).toBeVisible();

  // The same band on a screen in the other route group, which is what "every authenticated
  // screen" means: `(workspace)` and the two `(app)` screens outside it share one layout.
  await page.goto('/organization/users');
  await expect(page.getByRole('banner').getByText(organizationName)).toBeVisible();

  // **Exactly one of each, and the count is the assertion.** `<header>` maps to `banner` unless it
  // descends from `article`/`aside`/`main`/`nav`/`section`, and `RecordShell` renders one — so
  // introducing a real banner above the screens gave S-28 two, silently, and left every workspace
  // screen with chrome and nothing to skip into. Both are landmark-structure faults that axe's
  // WCAG tag set does not raise, so nothing else in this suite would ever have said so.
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);

  await page.goto('/account/credentials');
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
});

test('the user menu carries S-28 and the language choice, and signs out (§4.2, UC-06)', async ({
  page,
}) => {
  const email = addressFor('menu');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} Menu` }));

  await signIn(page, email);
  await accountTrigger(page, email).click();

  // S-28 moved here from the workspace tier in this task — §4.2 puts credentials under the
  // account corner, and task 27.7 put it in the nav only because no corner existed.
  await expect(page.getByRole('menuitem', { name: 'Date de autentificare' })).toBeVisible();
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Date de autentificare' }),
  ).toHaveCount(0);

  // Language is a submenu of this menu, not a separate control (§4.2). Switching is navigation to
  // the same address in another locale (UX-4), so the band comes back in Russian.
  //
  // **Driven by keyboard, and the reason is worth knowing before someone "fixes" it to a click.**
  // Playwright's mouse teleports: it dispatches one `mousemove` at the destination with no path.
  // Radix decides whether to keep a submenu open from the pointer's *direction of travel* — a
  // grace polygon toward the submenu — and a single point has no direction, so it closes the sub
  // and the click lands on the page behind it. Measured: the element is hit-testable and stable
  // at t=0, and `document.elementFromPoint` returns it, so nothing about the menu is wrong. A real
  // mouse produces a path and a real user is fine. The keyboard path is what a synthetic driver
  // can state honestly — and it is the one WCAG 2.2 AA requires (NFR-75) and that no other test
  // in the suite covers.
  await page.getByRole('menuitem', { name: /Limba interfeței/ }).click();
  const submenu = page.getByRole('menu', { name: /Limba interfeței/ });
  await expect(submenu).toBeVisible();
  await submenu.getByRole('menuitem', { name: 'Русский' }).press('Enter');
  await page.waitForURL('**/ru/home');
  await expect(page.getByRole('button', { name: `Ваша учётная запись: ${email}` })).toBeVisible();

  // Sign-out from inside the portal: the button is associated with a form outside the menu by id,
  // and this is the assertion that says the association survives Radix closing the menu.
  await page.getByRole('button', { name: `Ваша учётная запись: ${email}` }).click();
  await page.getByRole('menuitem', { name: 'Выйти из учётной записи' }).click();
  await page.waitForURL('**/sign-in**');

  await page.goto('/home');
  await page.waitForURL('**/sign-in?**');
});
