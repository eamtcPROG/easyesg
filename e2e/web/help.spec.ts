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
 * The help centre in a real browser (tasks 77, 227; UC-180 … UC-182; S-32, S-33, S-34), as `EasyESG Help
 * Centre.dc.html`'s artboards draw it: the library as topic cards and narrowed on the server, an article with its short
 * answer first and in the help's language the address chose, a request to support sent and given its reference, and
 * help first in every chrome's actions (UX-109), marked current inside the help centre.
 *
 * **The chrome is the session's and the content is not** (`architecture.md` §12.5.6's task-77 row (10)): a visitor
 * reads the help centre under the public band and footer, a member under the global tier — the same library either way,
 * and S-34 names a member from the account rather than asking. Each journey says which it is.
 *
 * Reads task 76's seeded library: six topics, an article in each, every one in all three languages. An article that
 * fell back to Romanian is `article-card.spec.tsx`'s, since no seeded article can.
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
const ENERGY_RU = 'Как счета за энергию превращаются в выбросы раздела B3';
const ASKS = 'Ce vă cere raportul și ce să pregătiți';
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
  test('is laid out as artboard 02 for a visitor: the questions, the topic cards, the account and the address', async ({
    page,
  }) => {
    await page.goto('/help');

    await expect(page.getByRole('heading', { level: 1, name: 'Citiți totul înainte de a decide ceva' })).toBeVisible();
    await expect(sectionHeadings(page)).toHaveText([
      'Întrebări de dinainte de înregistrare',
      'Toată biblioteca',
      'Una e să citiți',
      'Întrebați-ne direct',
    ]);
    // The first-report topic's article, its title the question (the task-227 row (3)).
    await expect(
      page.getByRole('region', { name: 'Întrebări de dinainte de înregistrare' }).getByRole('link', { name: ASKS }),
    ).toHaveAttribute('href', '/help/what-the-report-asks');
    await expect(page.getByRole('region', { name: 'Toată biblioteca' }).getByRole('heading', { level: 3 })).toHaveText(
      TOPICS,
    );
    // Support's mailbox, read with no session (row (4)).
    await expect(page.getByRole('link', { name: 'ajutor@easyesg.md' })).toHaveAttribute('href', 'mailto:ajutor@easyesg.md');
    // The visitor's frame: the band offers sign-in and marks the help centre current, and the footer stands once.
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('link', { name: 'Autentificare' })).toBeVisible();
    await expect(banner.getByRole('link', { name: HELP })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('narrows to a topic from its card, then to words, and says when nothing matches', async ({ page }) => {
    await page.goto('/help');
    await page.getByRole('link', { name: 'Cifre, unități, calcule', exact: true }).click();

    // The narrowing is the address, so it can be shared and survives a reload.
    await expect(page).toHaveURL(/[?&]topic=figures-and-calculations(&|$)/);
    await expect(page.getByRole('main').getByRole('heading', { level: 2, name: 'Cifre, unități, calcule' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: new RegExp(ENERGY) })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: new RegExp(ROLES) })).toHaveCount(0);

    // Words, without their marks: *facturile* finds the energy article's title, and nothing else. A GET form.
    await page.getByRole('searchbox', { name: 'Căutați în centrul de ajutor' }).fill('FACTURILE');
    await page.getByRole('button', { name: 'Căutați', exact: true }).click();
    await expect(page).toHaveURL(/[?&]q=FACTURILE(&|$)/);
    const results = page.getByRole('region', { name: '1 articol pentru „FACTURILE”' });
    await expect(results.getByRole('listitem')).toHaveCount(1);
    await expect(results.getByRole('link', { name: new RegExp(ENERGY) })).toHaveAttribute(
      'href',
      '/help/electricity-and-fuel',
    );

    await page.goto('/help?q=nimic-de-gasit');
    // The inventory's empty state: a status region, its title a line of it rather than a heading.
    await expect(page.getByRole('main').getByRole('status')).toContainText('Niciun articol nu se potrivește');
    await page.getByRole('link', { name: 'Arătați toată biblioteca' }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole('region', { name: 'Toată biblioteca' })).toBeVisible();
  });
});

test.describe('S-33, an article', () => {
  test('reads as artboard 03: the trail, the contents leading to each section, the short answer first', async ({ page }) => {
    await page.goto('/help/electricity-and-fuel');

    await expect(page.getByRole('heading', { level: 1, name: ENERGY })).toBeVisible();
    const trail = page.getByRole('navigation', { name: 'Firimituri' });
    await expect(trail.getByRole('link')).toHaveText([HELP, 'Cifre, unități, calcule']);
    // The summary is the short answer, above the sections (the task-227 row (6)).
    await expect(page.getByRole('heading', { level: 2, name: 'Răspunsul pe scurt' })).toBeVisible();
    const contents = page.getByRole('navigation', { name: 'Pe această pagină' });
    await expect(contents).toHaveCount(1);
    await expect(contents.getByRole('link').first()).toHaveText('Răspunsul pe scurt');
    await contents.getByRole('link', { name: 'Factorii folosiți' }).click();
    await expect(page).toHaveURL(/#section-2$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Factorii folosiți' })).toBeInViewport();

    await page.goto('/ru/help/electricity-and-fuel');
    await expect(page.getByRole('heading', { level: 1, name: ENERGY_RU })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    // Written in Russian, so nothing in it is marked as another language.
    await expect(page.getByRole('main').locator('[lang]')).toHaveCount(0);
  });

  test('reads in the help’s language the address chose, marked as written in it (the task-227 row (2))', async ({
    page,
  }) => {
    await page.goto('/help/electricity-and-fuel');
    await page.getByRole('link', { name: 'Русский' }).click();

    await expect(page).toHaveURL(/[?&]content=ru(&|$)/);
    const title = page.getByRole('heading', { level: 1, name: ENERGY_RU });
    await expect(title).toHaveAttribute('lang', 'ru');
    // The page's own words stay the page's: the interface is Romanian.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('heading', { level: 2, name: 'Răspunsul pe scurt' })).toBeVisible();
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
    // The card's foot names where it goes: support's mailbox, read with no session (the task-227 row (4)).
    await expect(page.getByText('Se trimite la ajutor@easyesg.md.', { exact: false })).toBeVisible();
    expect(await supportRequestsFrom(email)).toEqual([]);

    await page.getByRole('radio', { name: 'Exporturi și transmiterea raportului' }).check();
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
    // Artboard 01: the library greets the member by name under the global and workspace tiers, help marked current.
    await expect(page.getByRole('heading', { level: 1, name: `Cu ce vă putem ajuta, ${REGISTERED_DISPLAY_NAME}?` })).toBeVisible();
    await expect(sectionHeadings(page)).toHaveText(['Răsfoiți după ce aveți de făcut', 'Întrebați o persoană']);
    await expect(page.getByRole('region', { name: 'Răsfoiți după ce aveți de făcut' }).getByRole('heading', { level: 3 })).toHaveText(
      TOPICS,
    );
    await expect(accountTrigger(page, { email })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Secțiunile organizației' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: HELP })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    // The help's language, chosen apart from the interface's (the task-227 row (2)).
    await page.getByRole('link', { name: 'Русский' }).click();
    await expect(page).toHaveURL(/[?&]content=ru(&|$)/);
    await expect(page.getByText('Interfața rămâne în limba română')).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Цифры, единицы, расчёты' }).locator('xpath=ancestor::*[@lang][1]')).toHaveAttribute(
      'lang',
      'ru',
    );

    await page.getByRole('main').getByRole('link', { name: 'Scrieți asistenței' }).click();
    await page.waitForURL('**/help/contact');
    const known = page.getByRole('region', { name: 'Se trimit odată cu mesajul, ca să nu fie nevoie să le descrieți' });
    await expect(known).toContainText(REGISTERED_DISPLAY_NAME);
    await expect(known).toContainText(email);
    await expect(known).toContainText(organizationName);
    await expect(page.getByLabel('Numele dumneavoastră')).toHaveCount(0);

    await page.getByRole('radio', { name: 'Utilizatori și acces' }).check();
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
