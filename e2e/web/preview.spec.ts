import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedReport,
  setExportLocale,
  verificationTokenFor,
} from './support/db';

/**
 * S-10, the report preview (task 43.2; UC-41, FR-48), in a real browser: reached from S-07's bar, the api's document
 * framed with no script, in the account's export language until another is chosen, its pages opened in the frame, and
 * a view-only member told why there is none. The document's content is the api's suites'; this is the screen.
 */
const RUN_PREFIX = `e2e-web-preview-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(
  page: Page,
  input: { readonly label: string; readonly role?: 'editor' | 'viewer' },
): Promise<{ readonly reportId: string; readonly email: string }> {
  const email = `${RUN_PREFIX}-${input.label}@example.md`;
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

  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${input.label}`, role: input.role });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-${input.label} SRL` });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return { reportId, email };
}

/** The framed document, once it has loaded — the pending notice gone. */
async function framedDocument(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'Documentul se asamblează…' })).toHaveCount(0);
  return page.frameLocator('iframe[name="report-document"]');
}

test('S-07’s *review the report* opens the preview, the api’s document framed with no script, in the export language', async ({
  page,
}) => {
  const { reportId } = await signedInWithReport(page, { label: 'editor', role: 'editor' });
  await page.goto(`/reports/${reportId}/B1`);
  // Pressed at once: B1 sends what the company record gives as it opens, and a press while that is in flight is asked
  // about only until it lands — then the reader goes where they asked (`useLeaveGuard`).
  await page.getByRole('link', { name: 'Revizuiți raportul' }).click();
  await page.waitForURL(`**/reports/${reportId}/preview`);

  await expect(page.getByRole('heading', { level: 1, name: 'Previzualizarea raportului' })).toBeVisible();
  const frame = page.locator('iframe[name="report-document"]');
  await expect(frame).toHaveAttribute('sandbox', 'allow-same-origin');
  await expect(frame).toHaveAttribute('src', `/api/v1/reports/${reportId}/preview?locale=ro`);
  // The account's export default is its interface language until set apart, so the document opens in Romanian.
  const document = await framedDocument(page);
  await expect(document.locator('html')).toHaveAttribute('lang', 'ro');
  await expect(document.getByRole('heading', { level: 1, name: `${RUN_PREFIX}-editor SRL` })).toBeVisible();
  await expect(document.locator('script')).toHaveCount(0);
  // The language shown is marked; the way back leads to the report.
  await expect(page.getByRole('navigation', { name: 'Limba documentului' }).getByRole('link', { name: 'Română' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('link', { name: 'Înapoi la raport' })).toHaveAttribute('href', `/reports/${reportId}`);
});

test('opens in the account’s export language rather than the interface’s, and in another once it is chosen', async ({ page }) => {
  const { reportId, email } = await signedInWithReport(page, { label: 'language' });
  await setExportLocale({ email, locale: 'en' });
  await page.goto(`/reports/${reportId}/preview`);
  await expect((await framedDocument(page)).locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('navigation', { name: 'Limba documentului' }).getByRole('link', { name: 'Русский' }).click();
  await page.waitForURL(`**/reports/${reportId}/preview?language=ru`);
  const document = await framedDocument(page);
  await expect(document.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(document.getByRole('heading', { level: 2, name: /Основа подготовки/u })).toBeVisible();
});

test('opens each of the document’s pages in the frame', async ({ page }) => {
  const { reportId } = await signedInWithReport(page, { label: 'pages' });
  await page.goto(`/reports/${reportId}/preview?language=en`);
  await framedDocument(page);
  const pages = page.getByRole('navigation', { name: 'Paginile documentului' });
  // The cover, the contents, the omissions, the eleven modules of a Basic report, the provenance.
  await expect(pages.getByRole('link')).toHaveCount(15);
  await pages.getByRole('link', { name: /Energie/u }).click();
  await expect.poll(() => page.frame({ name: 'report-document' })?.url()).toMatch(/#B3$/u);
});

test('passes the accessibility scan, and so does the document it frames', async ({ page }) => {
  const { reportId } = await signedInWithReport(page, { label: 'scan' });
  await page.goto(`/reports/${reportId}/preview?language=en`);
  await framedDocument(page);
  // axe cannot run inside a frame that admits no script, so the screen is scanned without it and the document alone,
  // at its own address — the same markup, held to the same rules.
  const screen = await new AxeBuilder({ page }).withTags(WCAG).exclude('iframe[name="report-document"]').analyze();
  expect(screen.violations).toEqual([]);
  await page.goto(`/api/v1/reports/${reportId}/preview?locale=en`);
  const document = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(document.violations).toEqual([]);
});

test('tells a view-only member why there is no document, and frames none (182/22)', async ({ page }) => {
  const { reportId } = await signedInWithReport(page, { label: 'viewer', role: 'viewer' });
  await page.goto(`/reports/${reportId}/preview`);
  await expect(page.getByText('Doar un editor sau un administrator poate previzualiza raportul')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  // The refusal's own way back, inside the screen — the bar's arrow, above it, is named the same.
  await expect(page.getByRole('main').getByRole('link', { name: 'Înapoi la raport' })).toHaveAttribute(
    'href',
    `/reports/${reportId}`,
  );
});
