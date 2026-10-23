import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { COOKIE_POLICY_VERSION_IN_FORCE } from '../../packages/i18n/src/cookie-choice';
import {
  cleanupAccounts,
  cleanupCookieChoices,
  cleanupOrganizations,
  cookieChoiceRecord,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-31, the cookie choice, in a real browser (task 223; FR-206 AC-2, AC-3, AC-5, AC-8, AC-10; `design_spec.md` S-31,
 * OQ-27).
 *
 * What only a browser can say: **the banner shows on a first visit and blocks nothing** — the page reserves its height,
 * so the last of it scrolls clear; **an answer lands in the browser's jar and on the server**, and the banner does not
 * come back; **the settings open from a footer and offer nothing to switch**; and **a signed-in reader's answer names
 * their account**, which is the Server Action carrying the session to the api. The record's rules are
 * `apps/api/test/cookie-choice.e2e-spec.ts`'s.
 */
const RUN_PREFIX = `e2e-web-cookie-choice-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const COOKIE = 'easyesg_cookie_choice';
const recorded: string[] = [];
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupCookieChoices(recorded);
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

const banner = (page: Page) => page.getByRole('region', { name: 'Cookie-uri pe acest site' });

/** The record's id the browser holds — and remembered, so the run removes what it caused. */
async function answerHeld(context: BrowserContext): Promise<{ id: string; policyVersion: string }> {
  const cookie = (await context.cookies()).find((held) => held.name === COOKIE);
  expect(cookie, 'the answer is in the jar').toBeDefined();
  const [id, policyVersion] = decodeURIComponent(cookie!.value).split('~');
  recorded.push(id);
  return { id, policyVersion };
}

/** The page's foot sits above the banner's top — what the reserved height is for. */
async function footClearsBanner(page: Page, foot: ReturnType<Page['locator']>): Promise<void> {
  await foot.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 10_000);
  const [footBox, bannerBox] = await Promise.all([foot.boundingBox(), banner(page).boundingBox()]);
  expect(footBox!.y + footBox!.height).toBeLessThanOrEqual(bannerBox!.y + 1);
}

test('a first visit shows the banner, which covers nothing; an answer is kept, and not asked for again', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  // Nothing optional, so nothing to decline: two actions, and the second only opens the settings.
  await expect(banner(page).getByRole('button')).toHaveText(['Am înțeles', 'Setări cookie-uri']);
  await footClearsBanner(page, page.getByRole('contentinfo'));

  await banner(page).getByRole('button', { name: 'Am înțeles' }).click();
  await expect(banner(page)).toBeHidden();

  const answer = await answerHeld(context);
  expect(answer.policyVersion).toBe(COOKIE_POLICY_VERSION_IN_FORCE);
  await expect.poll(() => cookieChoiceRecord(answer.id)).toEqual({ policyVersion: COOKIE_POLICY_VERSION_IN_FORCE, email: null });

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner(page)).toBeHidden();

  // The cookie policy states the answer, read in the browser from the same cookie.
  await page.goto('/legal/cookies');
  await expect(page.getByText(/^Ați răspuns la anunțul despre cookie-uri pe /u)).toBeVisible();
});

test('the settings open from a footer, offer one category always on and nothing to switch, and Save answers', async ({
  page,
  context,
}) => {
  await page.goto('/legal/terms');
  await page.getByRole('contentinfo').getByRole('button', { name: 'Setări cookie-uri' }).click();

  const settings = page.getByRole('dialog', { name: 'Setări cookie-uri' });
  await expect(settings.getByText('Mereu active', { exact: true })).toBeVisible();
  await expect(settings.getByRole('list', { name: 'Cookie-urile necesare' })).toContainText(COOKIE);
  await expect(settings.getByRole('checkbox')).toHaveCount(0);
  await expect(settings.getByRole('switch')).toHaveCount(0);

  await settings.getByRole('button', { name: 'Salvați' }).click();
  await expect(settings).toBeHidden();
  await expect(banner(page)).toBeHidden();
  const answer = await answerHeld(context);
  await expect.poll(() => cookieChoiceRecord(answer.id)).toEqual({ policyVersion: COOKIE_POLICY_VERSION_IN_FORCE, email: null });
});

test('a signed-in reader’s answer names their account, and the banner covers nothing of the workspace', async ({
  page,
  context,
}) => {
  const email = `${RUN_PREFIX}-member@example.md`;
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Am citit și accept/ }).check();
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-member` }));
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  // The signed-in column is the viewport less the banner, so its own foot is never beneath it.
  await expect(banner(page)).toBeVisible();
  await footClearsBanner(page, page.getByRole('contentinfo'));

  await banner(page).getByRole('button', { name: 'Am înțeles' }).click();
  await expect(banner(page)).toBeHidden();
  const answer = await answerHeld(context);
  await expect.poll(() => cookieChoiceRecord(answer.id)).toEqual({ policyVersion: COOKIE_POLICY_VERSION_IN_FORCE, email });
});
