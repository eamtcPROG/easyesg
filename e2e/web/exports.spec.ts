import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupNotifications,
  cleanupOrganizations,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { untilHydrated } from './support/hydration';

/**
 * S-11, the export dialogue and its history (task 47; UC-42 … UC-44; FR-41, FR-44, FR-49 … FR-53), in a real browser
 * against the run's worker, renderer and storage: reached from S-07's bar, the two decisions with the caveat beside a
 * language whose labels carry no EFRAG standing, the warning listing a fresh report's unresolved findings and the export
 * that acknowledges them, the file watched until it is ready and downloaded, the history filtered, the report marked
 * filed and the mark withdrawn — and a view-only member told why there is none of it. The file's content is the api's
 * suites'; this is the screen.
 */
const RUN_PREFIX = `e2e-web-exports-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** A file printed by the run's renderer: the worker's queue, the print and the store, on a shared machine. */
const FILE_READY_MS = 150_000;
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupNotifications(organizations);
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(page: Page, input: { readonly label: string; readonly role?: 'editor' | 'viewer' }) {
  const email = `${RUN_PREFIX}-${input.label}@example.md`;
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
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
  return { reportId };
}

test('exports with the findings acknowledged, watches the file until it is ready, downloads it and marks the report filed', async ({
  page,
}) => {
  test.setTimeout(FILE_READY_MS + 120_000);
  const { reportId } = await signedInWithReport(page, { label: 'editor', role: 'editor' });
  await page.goto(`/reports/${reportId}/B1`);
  await page.getByRole('link', { name: 'Exportați', exact: true }).click();
  await page.waitForURL(`**/reports/${reportId}/export`);
  await expect(page.getByRole('heading', { level: 1, name: 'Exportați raportul' })).toBeVisible();

  // Two decisions: the PDF first, and the account's export language — Romanian, whose labels are the platform's at
  // this pin, so the statement stands beside it and names the language whose labels are EFRAG's own.
  const pdf = page.getByRole('radio', { name: /^PDF/u });
  await expect(pdf).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Română' })).toBeChecked();
  const caveat = page.getByRole('status').filter({ hasText: 'Aceste denumiri nu au statut oficial EFRAG' });
  await expect(caveat).toContainText('alegeți English');
  await untilHydrated(pdf);
  await page.getByRole('radio', { name: 'English' }).check();
  await expect(caveat).toHaveCount(0);
  await expect(page.getByText('Nu ați exportat încă niciun fișier')).toBeVisible();
  await expect(page.getByText('Puteți marca raportul ca depus după ce exportați un fișier al lui.')).toBeVisible();

  // A fresh report holds unresolved findings: the request is refused with them listed, never silently.
  await page.getByRole('button', { name: 'Exportați', exact: true }).click();
  const warning = page.getByRole('alert').filter({ hasText: /^Raportul are .*nerezolvat/u });
  await expect(warning).toBeVisible();
  const listed = warning.getByRole('list', { name: 'Ce este nerezolvat' }).getByRole('listitem');
  await expect(listed.first()).toBeVisible();
  await expect(listed.first().getByRole('link', { name: 'Mergeți la câmp' })).toHaveAttribute(
    'href',
    new RegExp(`/reports/${reportId}/B\\d+#`, 'u'),
  );
  await warning.getByRole('button', { name: /^Exportați cu/u }).click();

  // Queued: the request answered at once, the panel watches the file, and the history lists it while it is made.
  await expect(page.getByRole('status').filter({ hasText: 'Se pregătește PDF-ul în English' })).toBeVisible();
  const ready = page.getByRole('status').filter({ hasText: 'Fișierul este gata' });
  await expect(ready).toBeVisible({ timeout: FILE_READY_MS });
  const download = page.waitForEvent('download');
  await ready.getByRole('link', { name: 'Descărcați' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/u);

  // The history: the one row, ready, with its download named for it; a filter that matches nothing teaches and clears.
  const history = page.getByRole('table', { name: 'Exporturile acestui raport' });
  await expect(history.getByRole('row')).toHaveCount(2);
  await expect(history.getByText('PDF · English')).toBeVisible();
  await expect(history.getByText('Gata', { exact: true })).toBeVisible();
  await expect(history.getByRole('link', { name: /^Descărcați PDF-ul cerut la/u })).toHaveAttribute(
    'href',
    /^\/api\/v1\/exports\/[0-9a-f-]+\/file$/u,
  );
  await page.getByRole('combobox', { name: 'Formatul' }).click();
  await page.getByRole('option', { name: 'Excel' }).click();
  await page.waitForURL(`**/reports/${reportId}/export?format=xlsx`);
  await expect(page.getByText('Niciun export nu corespunde acestor filtre')).toBeVisible();
  await page.getByRole('button', { name: 'Ștergeți filtrele' }).click();
  await page.waitForURL(`**/reports/${reportId}/export`);
  await expect(history).toBeVisible();

  // Once a file is exported the report may be marked filed, on today unless said otherwise, and the mark withdrawn.
  await page.getByRole('button', { name: 'Marcați ca depus' }).click();
  await expect(page.getByLabel('Data depunerii')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Marcați ca depus' }).click();
  const mark = page.getByRole('status').filter({ hasText: /^Depus la /u });
  await expect(mark).toContainText('Marcat de Ana Popescu');
  await mark.getByRole('button', { name: 'Retrageți marcajul' }).click();
  await expect(mark).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Marcați ca depus' })).toBeVisible();
});

test('tells a view-only member why there is no export, and leads back to the report', async ({ page }) => {
  const { reportId } = await signedInWithReport(page, { label: 'viewer', role: 'viewer' });
  await page.goto(`/reports/${reportId}/export`);
  const refusal = page.getByRole('status').filter({ hasText: 'Doar un editor sau un administrator poate exporta raportul' });
  await expect(refusal).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  // The refusal's own way back, beside the bar's: the same words, both leading to the report.
  await expect(refusal.getByRole('link', { name: 'Înapoi la raport' })).toHaveAttribute('href', `/reports/${reportId}`);
});

test('passes the accessibility scan at first use', async ({ page }) => {
  const { reportId } = await signedInWithReport(page, { label: 'scan' });
  await page.goto(`/reports/${reportId}/export`);
  await expect(page.getByRole('heading', { level: 1, name: 'Exportați raportul' })).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(scan.violations).toEqual([]);
});
