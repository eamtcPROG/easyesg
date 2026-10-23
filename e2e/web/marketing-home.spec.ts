import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, verificationTokenFor } from './support/db';

/**
 * S-29, the marketing home (task 74.3; FR-204, UC-177), in a real browser — the prerendered page the bundle serves.
 *
 * **What the page must say is FR-204's acceptance, read from the page**: what the platform produces with no sign-in
 * wall (AC-1), the ways on — register, sign in, the help centre, the legal set (AC-2) — no price (AC-10), the same
 * page for a member (AC-9), in each locale at each of UX-73's frames with the WCAG scan clean (AC-6). Its +40% half is
 * `marketing-home.expansion.spec.ts`, which needs the padded server; its caching half is `static-rendering.spec.ts`.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const RUN_PREFIX = `e2e-web-marketing-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** Each locale's words as the reader meets them — wire values, so a catalogue edit breaks here on purpose. */
const HOMES = [
  {
    path: '/',
    prefix: '',
    lang: 'ro',
    title: 'easyESG — raportul de durabilitate al companiei dumneavoastră, după standardul VSME',
    heading: 'Raportul de durabilitate îl puteți întocmi chiar dumneavoastră.',
    start: 'Începeți raportul',
    questions: 'Vedeți întâi întrebările',
    sections: 'Unsprezece secțiuni. Acestea sunt toate.',
    firstSection: 'Baza de întocmire',
    help: 'centrul de ajutor',
    register: 'Creați un cont',
    signIn: 'Autentificare',
  },
  {
    path: '/en',
    prefix: '/en',
    lang: 'en',
    title: 'easyESG — your company’s sustainability report on the VSME standard',
    heading: 'You can write your own sustainability report.',
    start: 'Start your report',
    questions: 'See the questions first',
    sections: 'Eleven sections. This is all of them.',
    firstSection: 'Basis for preparation',
    help: 'help centre',
    register: 'Create an account',
    signIn: 'Sign in',
  },
  {
    path: '/ru',
    prefix: '/ru',
    lang: 'ru',
    title: 'easyESG — отчёт вашей компании об устойчивом развитии по стандарту VSME',
    heading: 'Отчёт об устойчивом развитии вы можете подготовить сами.',
    start: 'Начать отчёт',
    questions: 'Сначала посмотреть вопросы',
    sections: 'Одиннадцать разделов. Это все.',
    firstSection: 'Основа подготовки',
    help: 'справочном центре',
    register: 'Создать аккаунт',
    signIn: 'Вход',
  },
] as const;

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
] as const;

for (const home of HOMES) {
  test(`${home.path} says what the platform produces and how to go on, with no sign-in wall`, async ({ page }) => {
    const response = await page.goto(home.path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', home.lang);
    await expect(page).toHaveTitle(home.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);

    const main = page.getByRole('main');
    await expect(main).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(home.heading);

    // AC-2's ways on, each exactly once in the page's own content — the header's copies are outside `main`.
    await expect(main.getByRole('link', { name: home.start })).toHaveAttribute('href', `${home.prefix}/register`);
    await expect(main.getByRole('link', { name: home.register, exact: true })).toHaveAttribute(
      'href',
      `${home.prefix}/register`,
    );
    await expect(main.getByRole('link', { name: home.signIn, exact: true })).toHaveAttribute(
      'href',
      `${home.prefix}/sign-in`,
    );
    await expect(main.getByRole('link', { name: home.help })).toHaveAttribute('href', `${home.prefix}/help`);
    await expect(page.getByRole('contentinfo').getByRole('link')).toHaveCount(3);

    // The eleven Basic sections, named as the exported report names them.
    const sections = main.getByRole('region', { name: home.sections });
    await expect(sections.getByRole('listitem')).toHaveCount(11);
    await expect(sections.getByText(home.firstSection, { exact: true })).toBeVisible();
  });
}

test('the hero’s second way on lands on the eleven sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: HOMES[0].questions }).click();

  await expect(page).toHaveURL(/#questions$/);
  await expect(page.getByRole('region', { name: HOMES[0].sections })).toBeInViewport();
});

test('the pictures are pictures: captioned, and nothing in them takes focus', async ({ page }) => {
  await page.goto('/');

  const figures = page.getByRole('main').locator('figure');
  await expect(figures).toHaveCount(2);
  for (const figure of await figures.all()) {
    await expect(figure.locator('figcaption')).toHaveText(/\S/);
    await expect(figure.locator(':scope > [inert]')).toHaveCount(1);
  }
});

test('no price and no plan is written into the page (task 74.6)', async ({ page }) => {
  for (const home of HOMES) {
    await page.goto(home.path);
    const text = await page.getByRole('main').innerText();
    expect(text, home.path).not.toMatch(/\b(MDL|EUR|USD)\b|€|\$/);
  }
});

test('a signed-in member is served the same page, with no redirect (182/120)', async ({ page }) => {
  await signedIn(page, 'member');

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  expect(response?.request().redirectedFrom()).toBeNull();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(HOMES[0].heading);
});

for (const frame of FRAMES) {
  for (const home of HOMES) {
    test(`axe finds no violations on ${home.path} at ${frame.width}`, async ({ page }) => {
      await page.setViewportSize(frame);
      await page.goto(home.path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

async function signedIn(page: Page, label: string): Promise<void> {
  const email = `${RUN_PREFIX}-${label}@example.md`;
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

  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}
