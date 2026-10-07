import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  calcLinesOf,
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedCalcLine,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { workbookOf } from './support/workbook';

/**
 * S-09's spreadsheet import (task 204.2; FR-211, UC-215; `architecture.md` §12.5.6's task-204 row) — its claims in a
 * real browser against the real api: **a workbook's rows become lines once its columns and values are matched, the
 * rows it cannot read are reported by number before anything is added, the lines already there are untouched, lines
 * imported with no connection wait in the queue like typed ones, a file or sheet out of bounds is refused whole, and a
 * reader who may not write is not offered the import.**
 *
 * Every claim about what was added is checked against the rows (`calcLinesOf`). The `.xlsx` is built by the journey
 * (`support/workbook.ts`), so the rows it asserts on are the rows it states; its number cells hold a spreadsheet's
 * stored text, an exponent among them, which is the path an `.xlsx` alone exercises.
 */
const RUN_PREFIX = `e2e-web-calculator-import-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const SITES = [
  { name: 'Brutăria', locality: 'Chișinău' },
  { name: 'Magazinul', locality: 'Cahul' },
];
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(
  page: Page,
  input: { readonly label: string; readonly role?: 'viewer' },
): Promise<{ reportId: string; organizationId: string }> {
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

  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-${input.label}`,
    role: input.role,
  });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity`, sites: SITES });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return { reportId, organizationId };
}

const openImport = async (page: Page, reportId: string): Promise<Locator> => {
  await page.goto(`/reports/${reportId}/calculator`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energia dumneavoastră, în unitățile de pe facturi');
  await page.getByRole('button', { name: 'Importați dintr-un tabel', exact: true }).click();
  return page.getByRole('region', { name: 'Importați dintr-un tabel' });
};

const chooseFile = (panel: Locator, file: { name: string; mimeType: string; buffer: Buffer }) =>
  panel.getByLabel(/Trageți aici tabelul cu facturile/u).setInputFiles(file);

const csvFile = (name: string, text: string) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') });

/** Matches a value in a select the panel offers — Radix's listbox, portalled to the page. */
async function choose(page: Page, select: Locator, option: string): Promise<void> {
  await select.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('a workbook’s rows become lines once matched, the unreadable ones reported first, the old lines untouched (UC-215)', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, { label: 'workbook' });
  // A line already there, which the import must leave as it is (FR-211's behaviour 8).
  await seedCalcLine({ organizationId, reportId, siteOrdinal: 1, sourceKey: 'natural_gas', quantity: '90', unitCode: 'm3' });
  const panel = await openImport(page, reportId);

  await chooseFile(panel, {
    name: 'facturi.xlsx',
    mimeType: XLSX_TYPE,
    buffer: workbookOf([
      { name: 'Note', rows: [['Facturile anului 2025']] },
      {
        name: 'Facturi 2025',
        rows: [
          ['Sursă de energie', 'Locația', 'Cantitate', 'U.M.', 'Descriere'],
          ['Gaze naturale', 'Brutăria', { number: '1700.5' }, 'm3', 'Cuptor'],
          ['Curent', 'Magazinul', { number: '1.7E+4' }, 'kWh', null],
          ['Gaze naturale', 'Brutăria', null, 'm3', null],
          [null, null, null, null, null],
          ['Motorină pentru vehicule', 'Brutăria', '332,25', 'litri', 'Duba'],
        ],
      },
    ]),
  });

  // The first sheet holds no rows below its names: refused whole, with another sheet to choose.
  await expect(panel.getByText('Foaia nu are rânduri de importat')).toBeVisible();
  await choose(page, panel.getByRole('combobox', { name: 'Foaia de citit' }), 'Facturi 2025');

  // Each column proposed from its name.
  await expect(panel.getByRole('combobox', { name: 'Pentru ce este factura' })).toHaveText('Sursă de energie');
  await expect(panel.getByRole('combobox', { name: 'Cifra de pe factură' })).toHaveText('Cantitate');
  await expect(panel.getByRole('combobox', { name: 'Unitatea' })).toHaveText('U.M.');
  await expect(panel.getByRole('combobox', { name: 'Locația' })).toHaveText('Locația');
  await expect(panel.getByRole('combobox', { name: 'Descrierea, dacă există' })).toHaveText('Descriere');

  // A value the panel can read is matched; `Curent` is not, and its row is reported until it is.
  await expect(panel.getByRole('combobox', { name: '„Gaze naturale”' })).toHaveText('Gaze naturale');
  await expect(panel.getByRole('combobox', { name: '„litri”' })).toHaveText('litri');
  await expect(panel.getByText('Se vor adăuga 2 linii')).toBeVisible();
  const unreadable = panel.getByRole('status').filter({ hasText: 'nu pot fi citite' });
  await expect(unreadable.getByText('2 rânduri nu pot fi citite')).toBeVisible();
  await expect(unreadable.getByRole('listitem')).toHaveText([
    'Rândul 3 sursa „Curent” nu este potrivită cu o sursă a calculatorului — potriviți-o mai sus',
    'Rândul 4 nu are cifră — completați-o în fișier, iar dacă factura nu are una, adăugați linia și spuneți de ce',
  ]);

  await choose(page, panel.getByRole('combobox', { name: '„Curent”' }), 'Electricitate din rețea');
  await expect(panel.getByText('Se vor adăuga 3 linii')).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveText([
    'Rândul 4 nu are cifră — completați-o în fișier, iar dacă factura nu are una, adăugați linia și spuneți de ce',
  ]);
  // Nothing has been added while the reporter decides.
  expect(await calcLinesOf({ organizationId, reportId })).toHaveLength(1);

  await panel.getByRole('button', { name: 'Importați 3 linii' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByText('3 linii adăugate din facturi.xlsx')).toBeVisible();
  await expect
    .poll(() => calcLinesOf({ organizationId, reportId }))
    .toEqual([
      expect.objectContaining({ siteOrdinal: 1, sourceKey: 'natural_gas', quantity: '90', unitCode: 'm3' }),
      expect.objectContaining({ siteOrdinal: 0, sourceKey: 'natural_gas', quantity: '1700.5', unitCode: 'm3' }),
      expect.objectContaining({ siteOrdinal: 1, sourceKey: 'electricity_grid', quantity: '17000', unitCode: 'kWh' }),
      expect.objectContaining({ siteOrdinal: 0, sourceKey: 'diesel_road', quantity: '332.25', unitCode: 'l' }),
    ]);
  // On screen as typed lines are, in the unit of the file.
  await expect(page.getByRole('region', { name: 'Brutăria', exact: true }).getByText('Motorină pentru vehicule', { exact: true })).toBeVisible();
});

test('lines imported with no connection wait in the queue and are sent on reconnection, like typed ones (FR-38)', async ({ page, context }) => {
  const { reportId, organizationId } = await signedInWithReport(page, { label: 'offline' });
  const panel = await openImport(page, reportId);

  // Semicolons and a decimal comma, as a Romanian spreadsheet saves a .csv; natural gas is billed in one unit, so the
  // file needs no unit column.
  await chooseFile(panel, csvFile('facturi.csv', 'Sursa;Locația;Cifra\nGaze naturale;Magazinul;1 240,5\n'));
  await expect(panel.getByText('Se va adăuga 1 linie')).toBeVisible();
  // The file is read before the connection goes: the readers are chunks fetched when the panel opens, and nothing on
  // the page says when they have arrived, so a journey cutting the connection at once would race them — the first
  // version of this one did, and met the panel's no-connection refusal. What AC-8 claims is the import's, from here.
  await context.setOffline(true);
  await panel.getByRole('button', { name: 'Importați 1 linie' }).click();

  await expect(page.getByRole('region', { name: 'Magazinul', exact: true }).getByText('În așteptare', { exact: true })).toBeVisible();
  expect(await calcLinesOf({ organizationId, reportId })).toEqual([]);

  await context.setOffline(false);
  await expect
    .poll(() => calcLinesOf({ organizationId, reportId }))
    .toEqual([expect.objectContaining({ siteOrdinal: 1, sourceKey: 'natural_gas', quantity: '1240.5', unitCode: 'm3' })]);
});

test('a file that is not a spreadsheet, and a sheet over the row limit, are refused whole and add nothing', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, { label: 'refused' });
  const panel = await openImport(page, reportId);

  await chooseFile(panel, { name: 'factura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') });
  await expect(panel.getByRole('alert')).toHaveText(
    'Acest fișier nu este un tabel .xlsx sau .csv, deci nu poate fi citit. Salvați-l ca .xlsx sau .csv și alegeți-l din nou.',
  );

  const rows = Array.from({ length: 501 }, () => 'Gaze naturale;Brutăria;1').join('\n');
  await chooseFile(panel, csvFile('prea-multe.csv', `Sursa;Locația;Cifra\n${rows}\n`));
  await expect(panel.getByText('Foaia are mai mult de 500 de rânduri')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Importați', exact: true })).toBeDisabled();
  expect(await calcLinesOf({ organizationId, reportId })).toEqual([]);
});

test('a member who may only read is not offered the import', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, { label: 'viewer', role: 'viewer' });
  await seedCalcLine({ organizationId, reportId, siteOrdinal: 0, sourceKey: 'natural_gas', quantity: '500', unitCode: 'm3' });
  await page.goto(`/reports/${reportId}/calculator`);

  await expect(page.getByRole('region', { name: 'Brutăria', exact: true }).getByText('Gaze naturale', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importați dintr-un tabel' })).toHaveCount(0);
});
