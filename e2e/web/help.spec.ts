import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  cleanupSupportRequests,
  grantMembership,
  supportRequestsFrom,
  verificationTokenFor,
} from './support/db';
import { REGISTERED_DISPLAY_NAME, accountTrigger } from './support/session';

/**
 * The help centre in a real browser (task 77; UC-180 … UC-182; S-32, S-33, S-34): the library laid out and narrowed on
 * the server, an article in the reader's language, a request to support sent and given its reference, and help first
 * in every chrome's actions (UX-109).
 *
 * **The chrome is the session's and the content is not** (`architecture.md` §12.5.6's task-77 row (10)): a visitor
 * reads the help centre under the public band and footer, a member under the global tier — the same library either way,
 * and S-34 names a member from the account rather than asking. Each journey says which it is.
 *
 * Reads task 76's seeded library: six topics, an article in each, every one in all three languages. An article that
 * fell back to Romanian is `help-article.spec.tsx`'s, since no seeded article can.
 */
const RUN_PREFIX = `e2e-web-help-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';

const TOPICS = [
  'Primul raport',
  'Completarea secțiunilor',
  'Cifre, unități, calcule',
  'Entități, perioade, blocare',
  'Export și transmitere',
  'Cont și utilizatori',
];
const ENERGY = 'Cum devin facturile de energie emisiile din B3';
const ROLES = 'Ce poate face fiecare rol';
const HELP = 'Centrul de ajutor';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupSupportRequests(RUN_PREFIX);
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string): Promise<{ email: string; organizationName: string }> {
  const email = `${RUN_PREFIX}-${label}@example.md`;
  const organizationName = `${RUN_PREFIX}-${label}`;
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

  organizations.push(await grantMembership({ email, organizationName }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return { email, organizationName };
}

/** The level-two headings of the screen's own content — asserted with `toHaveText([...])`, exact in count and order. */
const sectionHeadings = (page: Page) => page.getByRole('main').getByRole('heading', { level: 2 });

/** The banner's visible links, named as a screen reader names them — the brand first, then the actions. */
const bannerLinks = (banner: Locator) =>
  banner
    .getByRole('link')
    .evaluateAll((links) =>
      links
        .filter((link) => link.checkVisibility())
        .map((link) => link.getAttribute('aria-label') ?? link.textContent?.trim() ?? ''),
    );

async function choose(page: Page, input: { readonly field: string; readonly option: string }): Promise<void> {
  await page.getByRole('combobox', { name: input.field }).click();
  await page.getByRole('option', { name: input.option, exact: true }).click();
}

test.describe('S-32, the library', () => {
  test('is laid out by topic, in the topics’ order, under the public chrome for a visitor', async ({ page }) => {
    await page.goto('/help');

    await expect(page.getByRole('heading', { level: 1, name: 'Cu ce vă putem ajuta?' })).toBeVisible();
    await expect(sectionHeadings(page)).toHaveText([...TOPICS, 'Nu ați găsit răspunsul?']);
    await expect(page.getByRole('main').getByRole('link', { name: ENERGY })).toHaveAttribute(
      'href',
      '/help/electricity-and-fuel',
    );
    // The visitor's frame: the band offers sign-in, and the footer stands once.
    await expect(page.getByRole('banner').getByRole('link', { name: 'Autentificare' })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('narrows to a topic, then to words, and says when nothing matches', async ({ page }) => {
    await page.goto('/help');
    await choose(page, { field: 'Subiectul', option: 'Cifre, unități, calcule' });
    await page.getByRole('button', { name: 'Căutați' }).click();

    // A GET form: the narrowing is the address, so it can be shared and survives a reload.
    await expect(page).toHaveURL(/[?&]topic=figures-and-calculations(&|$)/);
    await expect(sectionHeadings(page)).toHaveText(['Cifre, unități, calcule', 'Nu ați găsit răspunsul?']);
    await expect(page.getByRole('main').getByRole('link', { name: ROLES })).toHaveCount(0);

    // Words, without their marks: *facturile* finds the energy article's title, and nothing else.
    await page.goto('/help?q=FACTURILE');
    await expect(page.getByRole('main').getByRole('link', { name: ENERGY })).toBeVisible();
    await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(1);

    await page.goto('/help?q=nimic-de-gasit');
    // The inventory's empty state: a status region, its title a line of it rather than a heading.
    await expect(page.getByRole('main').getByRole('status')).toContainText('Niciun articol nu se potrivește');
    await page.getByRole('link', { name: 'Arătați toată biblioteca' }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(sectionHeadings(page)).toHaveText([...TOPICS, 'Nu ați găsit răspunsul?']);
  });
});

test.describe('S-33, an article', () => {
  test('reads in the page’s language, its contents leading to each section', async ({ page }) => {
    await page.goto('/help/electricity-and-fuel');

    await expect(page.getByRole('heading', { level: 1, name: ENERGY })).toBeVisible();
    // The docked list at this window; the disclosed one is the narrow frames'.
    const contents = page.getByRole('navigation', { name: 'Pe această pagină' }).filter({ visible: true });
    await expect(contents).toHaveCount(1);
    await contents.getByRole('link', { name: 'Factorii folosiți' }).click();
    await expect(page).toHaveURL(/#section-2$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Factorii folosiți' })).toBeInViewport();

    await page.goto('/ru/help/electricity-and-fuel');
    await expect(page.getByRole('heading', { level: 1, name: 'Как счета за энергию превращаются в выбросы раздела B3' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    // Written in Russian, so nothing in it is marked as another language.
    await expect(page.getByRole('main').locator('[lang]')).toHaveCount(0);
  });

  test('that the library does not hold answers the not-found surface', async ({ page }) => {
    const response = await page.goto('/help/oarecare-articol');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Această adresă nu există' })).toBeVisible();
  });
});

test.describe('S-34, writing to support', () => {
  test('a visitor gives a name and an address, and is given the request’s reference', async ({ page }) => {
    const email = `${RUN_PREFIX}-visitor@example.md`;
    await page.goto('/help/contact');

    // Nothing filled: the form refuses on the page, and sends nothing.
    await page.getByRole('button', { name: 'Trimiteți asistenței' }).click();
    await expect(page.getByText('Câteva câmpuri au nevoie de atenție înainte de a putea trimite cererea')).toBeVisible();
    expect(await supportRequestsFrom(email)).toEqual([]);

    await choose(page, { field: 'Despre ce este vorba?', option: 'Exporturi' });
    await page.getByLabel('Întrebarea dumneavoastră').fill('Raportul nu se descarcă în Excel.');
    await choose(page, { field: 'Răspundeți-mi în', option: 'Rusă' });
    await page.getByLabel('Numele dumneavoastră').fill('Ion Rusu');
    await page.getByLabel('Adresa de e-mail pentru răspuns').fill(email);
    await page.getByRole('button', { name: 'Trimiteți asistenței' }).click();

    await expect(page.getByText('Cererea a fost trimisă')).toBeVisible();
    const [stored] = await supportRequestsFrom(email);
    expect(stored).toMatchObject({
      sender_name: 'Ion Rusu',
      organization_name: null,
      topic: 'exports',
      reply_locale: 'ru',
      question: 'Raportul nu se descarcă în Excel.',
    });
    // The reference on screen is the one recorded, which is what a reader quotes when they write again.
    expect(stored.reference).toMatch(/^SR-\d{6,}$/u);
    await expect(page.getByText(`Referința ei este ${stored.reference}.`, { exact: false })).toBeVisible();
  });

  test('a member is named from the account, under the global tier, and help opens every chrome’s actions', async ({
    page,
  }) => {
    // UX-109 before the session: help is the first action in the identity header and in the public band.
    await page.goto('/sign-in');
    expect((await bannerLinks(page.getByRole('banner')))[1]).toBe(HELP);
    await page.goto('/legal/terms');
    expect((await bannerLinks(page.getByRole('banner')))[1]).toBe(HELP);

    const { email, organizationName } = await signedIn(page, 'member');
    // …and in the global tier, after the brand.
    expect((await bannerLinks(page.getByRole('banner')))[1]).toBe(HELP);

    await page.getByRole('banner').getByRole('link', { name: HELP }).click();
    await page.waitForURL('**/help');
    // The library is the visitor's; the frame is the workspace's.
    await expect(sectionHeadings(page)).toHaveText([...TOPICS, 'Nu ați găsit răspunsul?']);
    await expect(accountTrigger(page, { email })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    await page.getByRole('main').getByRole('link', { name: 'Scrieți asistenței' }).click();
    await page.waitForURL('**/help/contact');
    const known = page.getByRole('region', { name: 'Trimis împreună cu cererea, ca să nu fie nevoie să le scrieți' });
    await expect(known).toContainText(REGISTERED_DISPLAY_NAME);
    await expect(known).toContainText(email);
    await expect(known).toContainText(organizationName);
    await expect(page.getByLabel('Numele dumneavoastră')).toHaveCount(0);

    await choose(page, { field: 'Despre ce este vorba?', option: 'Utilizatori și acces' });
    await page.getByLabel('Întrebarea dumneavoastră').fill('Nu pot invita un coleg.');
    await page.getByRole('button', { name: 'Trimiteți asistenței' }).click();

    await expect(page.getByText('Cererea a fost trimisă')).toBeVisible();
    expect(await supportRequestsFrom(email)).toEqual([
      expect.objectContaining({
        sender_name: REGISTERED_DISPLAY_NAME,
        organization_name: organizationName,
        topic: 'access',
        reply_locale: 'ro',
      }),
    ]);
  });
});
