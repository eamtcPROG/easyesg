import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';
import { accountTrigger } from './support/session';

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
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
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
  await expect(accountTrigger(page, { email })).toBeVisible();

  // **The trigger shows the NAME and is named by the ADDRESS** (UX-137, task 140), and the split is
  // the point: the name is what a reader recognises, the address is the unique fact that settles
  // *which* account when two people share a display name — which is why it stays the accessible
  // name above rather than following the visible text.
  //
  // Asserted as the whole run rather than as two `toContainText`s. The avatar is `aria-hidden` and
  // adjacent, so the trigger's text is the monogram immediately followed by the name with no
  // separator — `APAna Popescu` — and an equality is what fails if either half is dropped.
  //
  // **What this does NOT check is where `AP` was computed**, and the first draft of this comment
  // claimed it did. For an account called *Ana Popescu* a browser-side `monogram(displayName)` and
  // the session's own value agree, so both satisfy the line above. The two diverge only for an
  // account with **no** name, where the composite has collapsed to the address and splitting it
  // would show an initial cut from an email — and no journey here reaches that account, because
  // S-01 requires both name fields. That refusal is guarded at unit level instead, twice:
  // `display-name.spec.ts`'s *"gives nothing at all … rather than an initial from the address"* and
  // `account-menu.spec.tsx`'s glyph case. What is unguarded end to end is the wiring between them.
  await expect(accountTrigger(page, { email })).toHaveText('APAna Popescu');

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

test('the band and the workspace tier stay in place while the screen scrolls beneath them (§4.2)', async ({ page }) => {
  const email = addressFor('scroll');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} Livada` }));
  await signIn(page, email);

  // A window short enough that S-05 overflows the region beneath the two tiers, so there is something to scroll.
  await page.setViewportSize({ width: 1440, height: 420 });
  const band = page.getByRole('banner');
  const tier = page.getByRole('navigation', { name: 'Secțiunile organizației' });
  const footer = page.getByRole('contentinfo');
  await expect(footer).not.toBeInViewport();
  const tierBefore = await tier.boundingBox();

  // The wheel over the screen, as a reader scrolls it (28 Sep 2026, project owner). The footer arriving proves the
  // region scrolled; the band and the tier where they were prove nothing else did — with the document scrolling, as
  // it did before, both leave the top of the window.
  const main = await page.getByRole('main').boundingBox();
  await page.mouse.move((main?.x ?? 0) + 200, (main?.y ?? 0) + 100);
  await page.mouse.wheel(0, 4000);
  await expect(footer).toBeInViewport();
  expect((await band.boundingBox())?.y).toBe(0);
  expect((await tier.boundingBox())?.y).toBe(tierBefore?.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

/**
 * Task 173 (project owner, 28 Sep 2026; §4.2's amendment): the organization's administration is drawn locked for a
 * member whose role may not open it, in every frame that draws the workspace tier — the band, the account rail, and the
 * compact drawer. **Asserted on the served build rather than only on the components**, because what decides the lock is
 * the membership read on the server and handed down, and a jsdom spec is handed its sections by the test.
 */
const LOCKED_NOTE = '(doar pentru administratorii organizației)';

test('an editor sees the organization’s administration locked, in the band, the rail and the drawer (§4.2)', async ({
  page,
}) => {
  const email = addressFor('editor');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} Editare`, role: 'editor' }));
  await signIn(page, email);

  // The band. Exact lists on both sides of the line: a locked Entities fails as surely as an open Users.
  const band = page.getByRole('navigation', { name: 'Secțiunile organizației' });
  await expect(band.locator('[aria-disabled="true"]')).toHaveText([
    `Organizația ${LOCKED_NOTE}`,
    `Utilizatori și acces ${LOCKED_NOTE}`,
  ]);
  await expect(band.locator('a[href]')).toHaveText(['Acasă', 'Rapoarte', 'Entități']);

  // The rail, where it replaces the band (S-27).
  await page.goto('/account');
  const rail = page.getByRole('navigation', { name: 'Secțiunile organizației' });
  await expect(rail.locator('[aria-disabled="true"]')).toHaveText([
    `Organizația ${LOCKED_NOTE}`,
    `Utilizatori și acces ${LOCKED_NOTE}`,
  ]);

  // The drawer, at the phone frame — where a tap on a locked row must leave the panel standing, since it went nowhere.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
  await page.getByRole('button', { name: 'Meniu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Meniu' });
  const locked = drawer.getByRole('link', { name: `Utilizatori și acces ${LOCKED_NOTE}` });
  await expect(locked).toHaveAttribute('aria-disabled', 'true');
  // `force`, because Playwright's actionability check refuses an `aria-disabled` element — which is the state this
  // asserts. The reader's tap still lands; what is under test is that it goes nowhere and closes nothing.
  await locked.click({ force: true });
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/\/home$/);

  // The boundary is still the api's: the address typed rather than followed meets the screen's own permission state.
  await page.goto('/organization/users');
  await expect(page.getByText('Această pagină este pentru administratorii organizației')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Înapoi la pagina principală' })).toBeVisible();
});

test('an administrator’s tier locks nothing (§4.2)', async ({ page }) => {
  const email = addressFor('administrator');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} Administrare` }));
  await signIn(page, email);

  const band = page.getByRole('navigation', { name: 'Secțiunile organizației' });
  await expect(band.locator('[aria-disabled="true"]')).toHaveCount(0);
  await expect(band.getByRole('link', { name: 'Utilizatori și acces', exact: true })).toHaveAttribute(
    'href',
    '/organization/users',
  );
});

test('the user menu carries S-28 and the language choice, and signs out (§4.2, UC-06)', async ({
  page,
}) => {
  const email = addressFor('menu');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} Menu` }));

  await signIn(page, email);
  await accountTrigger(page, { email }).click();

  // S-28 moved here from the workspace tier in this task — §4.2 puts credentials under the
  // account corner, and task 27.7 put it in the nav only because no corner existed.
  await expect(page.getByRole('menuitem', { name: 'Credențiale', exact: true })).toBeVisible();
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Credențiale', exact: true }),
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
  await expect(accountTrigger(page, { email, label: 'Ваша учётная запись' })).toBeVisible();

  // Sign-out from inside the portal: the button is associated with a form outside the menu by id,
  // and this is the assertion that says the association survives Radix closing the menu.
  await accountTrigger(page, { email, label: 'Ваша учётная запись' }).click();
  await page.getByRole('menuitem', { name: 'Выйти из учётной записи' }).click();
  await page.waitForURL('**/sign-in**');

  await page.goto('/home');
  await page.waitForURL('**/sign-in?**');
});

/**
 * Task 203.3 (UX-99): the first thing a keyboard reaches on every page is the skip link, and following it puts focus
 * in `<main>` — on a signed-out Focus screen, a workspace screen and the account rail's.
 */
test('every page opens on a skip link that moves focus to the main content (UX-99)', async ({ page }) => {
  const skipToMain = async (address: string) => {
    await page.goto(address);
    await page.keyboard.press('Tab');
    const link = page.getByRole('link', { name: 'Treceți la conținutul principal' });
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main-content')).toBeFocused();
  };

  await skipToMain('/sign-in');
  const email = addressFor('skip');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-skip` }));
  await signIn(page, email);
  await skipToMain('/home');
  await skipToMain('/account/credentials');
});
