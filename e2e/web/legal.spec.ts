import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, verificationTokenFor } from './support/db';

/**
 * S-30's legal set and the cookie policy's disclosure (FR-205, FR-206; task 75.3 and 75.5) in a real browser.
 *
 * **What only a browser can say is that the policy is true of what the browser was given.** The inventory's own spec
 * holds the policy to the source; here a real sign-in collects the cookies the site actually set and each must be on
 * the page — the claim UC-179 makes, read from the far end.
 *
 * The terms and the privacy notice wait for their text (task 75.4), so they still answer *not yet available*.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const RUN_PREFIX = `e2e-web-legal-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const organizations: string[] = [];

/** The eight cookies OQ-23 and 182/122 enumerate, as wire values — a rename must break here. */
const COOKIES = [
  'easyesg_session',
  'NEXT_LOCALE',
  'easyesg_social',
  'easyesg_factor_challenge',
  'easyesg_pending_link',
  'easyesg_setup_grant',
  'easyesg_admin_session',
  'easyesg_admin_challenge',
];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

const cookieTable = (page: Page) => page.getByRole('table', { name: 'Cookie-urile setate de platformă' });

test('the cookie policy names every cookie the platform sets, within the set, and asks nothing', async ({ page }) => {
  await page.goto('/legal/cookies');

  await expect(page.getByRole('heading', { level: 1, name: 'Politica de cookie-uri' })).toBeVisible();
  // The set's strip: the three documents, this one current (FR-205 AC-3). Named for the set, so it is not the footer's
  // legal links under a second name — the landmark rule's finding in Russian, where the two read the same.
  const peers = page.getByRole('navigation', { name: 'Setul de documente legale' });
  await expect(peers.getByRole('link')).toHaveCount(3);
  await expect(peers.getByRole('link', { name: 'Politica de cookie-uri' })).toHaveAttribute('aria-current', 'page');
  await expect(peers.getByRole('link', { name: 'Termeni și condiții' })).toHaveAttribute('href', '/legal/terms');

  // Every cookie, once (FR-206 AC-1) — exact, so a cookie drawn twice or missing is the failure.
  const names = await cookieTable(page).locator('tbody th').allInnerTexts();
  expect(names).toEqual(COOKIES);
  await expect(page.getByRole('heading', { level: 2, name: 'Ce nu setăm' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Ce păstrăm în browser în afara cookie-urilor' })).toBeVisible();

  // Nothing to accept or decline (FR-206 AC-2): no control of any kind on the disclosure.
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('every cookie a signed-in browser holds is on the policy', async ({ page, context }) => {
  const email = `${RUN_PREFIX}-held@example.md`;
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-held` }));
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  const held = (await context.cookies()).map((cookie) => cookie.name);
  // The scan is looking at something: a signed-in browser holds the session.
  expect(held).toContain('easyesg_session');

  await page.goto('/legal/cookies');
  const listed = await cookieTable(page).locator('tbody th').allInnerTexts();
  expect(held.filter((name) => !listed.includes(name))).toEqual([]);
});

test('reading the policy stores nothing and raises nothing over the page', async ({ page, context }) => {
  await page.goto('/legal/cookies');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // FR-206 AC-3, AC-8: no consent record, no remembered dismissal, no overlay.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => [sessionStorage.length, localStorage.length])).toEqual([0, 0]);
  // Whatever the visit set is one of the cookies the policy lists.
  expect((await context.cookies()).map((cookie) => cookie.name).filter((name) => !COOKIES.includes(name))).toEqual([]);
});

test('the terms and the privacy notice wait for their text, and a document outside the set does not exist', async ({
  page,
}) => {
  for (const document of ['terms', 'privacy']) {
    await page.goto(`/legal/${document}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Această parte nu este încă disponibilă' })).toBeVisible();
  }
  const outside = await page.goto('/legal/sub-processors');
  expect(outside?.status()).toBe(404);
});

test('the policy is live in all three locales', async ({ page }) => {
  await page.goto('/en/legal/cookies');
  await expect(page.getByRole('heading', { level: 1, name: 'Cookie policy' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'The set of legal documents' }).getByRole('link', { name: 'Terms of service' })).toHaveAttribute(
    'href',
    '/en/legal/terms',
  );

  await page.goto('/ru/legal/cookies');
  await expect(page.getByRole('heading', { level: 1, name: 'Политика cookie' })).toBeVisible();
});

/** `design_spec.md` §4.6, resolved 9 Oct 2026: docked contents at `wide`, a closed disclosure and a scrolled strip below. */
test.describe('the Content archetype at its frames', () => {
  test('docks the contents beside the text at wide', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/legal/cookies');
    const docked = page.getByRole('navigation', { name: 'Pe această pagină' });
    // Exactly one is exposed: the disclosure's copy is not displayed at this width.
    await expect(docked).toHaveCount(1);
    await expect(docked.getByRole('link')).toHaveCount(4);
    await expect(page.locator('summary', { hasText: 'Pe această pagină' })).toBeHidden();
  });

  test('closes the contents into a disclosure, and scrolls the strip to the document being read, at compact', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/legal/cookies');

    const summary = page.locator('summary', { hasText: 'Pe această pagină' });
    await expect(summary).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pe această pagină' })).toHaveCount(0);
    await summary.click();
    await expect(page.getByRole('navigation', { name: 'Pe această pagină' }).getByRole('link')).toHaveCount(4);

    // The last of the three is the one being read; the strip shows it whole. Read inside the strip: the footer carries a
    // link of the same name.
    const stripNav = page.getByRole('navigation', { name: 'Setul de documente legale' });
    const strip = await stripNav.boundingBox();
    const current = await stripNav.getByRole('link', { name: 'Politica de cookie-uri', exact: true }).boundingBox();
    expect(strip && current).toBeTruthy();
    expect(current!.x).toBeGreaterThanOrEqual(strip!.x);
    expect(current!.x + current!.width).toBeLessThanOrEqual(strip!.x + strip!.width + 1);
  });

  /** At a phone's width the four columns fit inside the table's card with every word whole — no hyphenation needed. */
  test('fits the cookie table inside its card at a phone’s width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/legal/cookies');
    // Hyphenation off, so the claim holds on a host without a dictionary as well as on one with it.
    await page.addStyleTag({ content: 'table th, table td { hyphens: manual !important; }' });
    // Read against the card rather than the page: the column's gutter hides a few pixels of overflow from the page's
    // width while the table runs through the card's border.
    const overflow = await cookieTable(page).evaluate(
      (table) => table.getBoundingClientRect().width - (table.parentElement?.clientWidth ?? 0),
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  /**
   * At 320px — the frame 400 % zoom leaves a laptop (UX-103) — one Russian word outgrows its column wherever the browser
   * cannot hyphenate it. The test turns hyphenation off, as a browser without a Russian dictionary has it, so the arm is
   * the same on every host: the card scrolls sideways inside itself, the page does not, and the card is a region a
   * keyboard can reach — which axe's scrollable-region rule, run on this frame, is what checks.
   */
  test('scrolls the card, never the page, and lets a keyboard reach it, where a word cannot be hyphenated at 320px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/ru/legal/cookies');
    await page.addStyleTag({ content: 'table th, table td { hyphens: manual !important; }' });

    const card = page.getByRole('region', { name: 'Cookie, которые устанавливает платформа' });
    await expect(card).toHaveAttribute('tabindex', '0');
    const widths = await card.evaluate((box) => ({
      card: box.scrollWidth - box.clientWidth,
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    // The arm is reached: without hyphenation the columns cannot fit.
    expect(widths.card).toBeGreaterThan(0);
    expect(widths.page).toBe(0);
    expect((await new AxeBuilder({ page }).withTags(WCAG).analyze()).violations).toEqual([]);
  });
});
