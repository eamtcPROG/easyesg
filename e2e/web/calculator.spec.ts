import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  calcLinesOf,
  cleanupAccounts,
  cleanupOrganizations,
  disclosureValueOf,
  grantMembership,
  seedCalcRun,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * S-09, the carbon calculator (task 39.1; UC-32, FR-33, FR-38, UX-40, UX-41) — the claims its entry half makes, in a
 * real browser against the real api: **bills are entered by source and site in the unit printed on them, they persist
 * with no save action, a line entered offline is queued and sent on reconnection like any field, and the monthly form
 * sums twelve months and names the ones left empty.**
 *
 * Each claim is checked against the row (`calcLinesOf`), so an acknowledgement is held to the commit it claims
 * (NFR-56). The report is seeded with two sites in its period's snapshot — B1's rows, which a line must belong to.
 */
const RUN_PREFIX = `e2e-web-calculator-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';
const SITES = [
  { name: 'Brutăria', locality: 'Chișinău' },
  { name: 'Magazinul', locality: 'Cahul' },
];

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(page: Page, label: string): Promise<{ reportId: string; organizationId: string }> {
  const email = addressFor(label);
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity`, sites: SITES });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return { reportId, organizationId };
}

const openCalculator = async (page: Page, reportId: string, query = '') => {
  await page.goto(`/reports/${reportId}/calculator${query}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energia dumneavoastră, în unitățile de pe facturi');
};

/** *Adăugați o sursă*: a source, a site, the figure and its unit — the form the artboard's 8.3 draws. */
async function addLine(
  page: Page,
  input: { readonly source: string; readonly site: string; readonly figure: string; readonly unit?: string },
): Promise<void> {
  await page.getByRole('button', { name: 'Adăugați o sursă', exact: true }).click();
  const form = page.getByRole('region', { name: 'Adăugați o sursă' });
  await form.getByRole('combobox', { name: 'Ce este' }).click();
  await page.getByRole('option', { name: new RegExp(`^${input.source}`, 'u') }).click();
  await form.getByRole('combobox', { name: 'Care locație' }).click();
  await page.getByRole('option', { name: input.site, exact: true }).click();
  await form.getByLabel('Cifra de pe factura dumneavoastră').fill(input.figure);
  if (input.unit !== undefined) {
    await form.getByRole('combobox', { name: 'Unitatea' }).click();
    await page.getByRole('option', { name: input.unit, exact: true }).click();
  }
  await form.getByRole('button', { name: 'Adăugați linia' }).click();
  await expect(form).toHaveCount(0);
}

const site = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

test('a bill is entered by source and site, in the unit printed on it, and stays (UC-32, UX-40, UX-41)', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'entry');
  await openCalculator(page, reportId);

  // Empty — first use: the bills to hand, before anything is entered.
  await expect(page.getByText('Pregătiți facturile de energie')).toBeVisible();

  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '1 700,5' });
  const bakery = site(page, 'Brutăria');
  await expect(bakery.getByText('Gaze naturale', { exact: true })).toBeVisible();
  // The cubic metres stay cubic metres: no unit to choose for a source entered in one, and the figure as typed.
  await expect(bakery.getByText('m³', { exact: true })).toBeVisible();
  await expect
    .poll(() => calcLinesOf({ organizationId, reportId }))
    .toEqual([
      {
        siteOrdinal: 0,
        sourceKey: 'natural_gas',
        quantity: '1700.5',
        unitCode: 'm3',
        notAvailableReason: null,
        monthlyQuantities: null,
        overrideTonnes: null,
        overrideExplanation: null,
      },
    ]);

  // Stays after a calculation's worth of time and a reload — the record UX-41 keeps on screen.
  await page.reload();
  await expect(site(page, 'Brutăria').getByText('Gaze naturale', { exact: true })).toBeVisible();
  await expect(site(page, 'Brutăria').getByRole('textbox', { name: 'Cifra de pe factură' })).toHaveValue('1700.5');
});

test('a line with several units asks which one the bill reads in, and none is assumed', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'units');
  await openCalculator(page, reportId);

  await addLine(page, { source: 'Electricitate din rețea', site: 'Magazinul', figure: '17000', unit: 'kWh' });
  await expect
    .poll(() => calcLinesOf({ organizationId, reportId }))
    .toMatchObject([{ siteOrdinal: 1, sourceKey: 'electricity_grid', quantity: '17000', unitCode: 'kWh' }]);
});

test('a line entered offline is queued and sent on reconnection, like any field (FR-38)', async ({ page, context }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'offline');
  await openCalculator(page, reportId);

  await context.setOffline(true);
  await addLine(page, { source: 'Motorină pentru vehicule', site: 'Brutăria', figure: '332' });
  // The line is on screen at once, marked as waiting, and nothing has reached the store.
  await expect(site(page, 'Brutăria').getByText('În așteptare', { exact: true })).toBeVisible();
  await expect(page.getByText('Modificările nu au fost încă trimise')).toBeVisible();
  expect(await calcLinesOf({ organizationId, reportId })).toEqual([]);

  await context.setOffline(false);
  await expect
    .poll(() => calcLinesOf({ organizationId, reportId }))
    .toMatchObject([{ sourceKey: 'diesel_road', quantity: '332', unitCode: 'l' }]);
  await expect(site(page, 'Brutăria').getByText('În așteptare', { exact: true })).toHaveCount(0);
});

test('the monthly form sums the months entered and names the ones left empty (task 39.1)', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'monthly');
  await openCalculator(page, reportId);
  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '500' });

  const bakery = site(page, 'Brutăria');
  await bakery.getByRole('button', { name: 'Introduceți pe luni' }).click();
  const months = bakery.getByRole('group', { name: 'Gaze naturale, lună de lună' });
  const figures = ['40', '45', '', '38', '30', '22', '18', '17', '21', '33', '41', '48,5'];
  const fields = months.getByRole('textbox');
  await expect(fields).toHaveCount(12);
  for (const [index, figure] of figures.entries()) {
    if (figure === '') continue;
    await fields.nth(index).fill(figure);
    await fields.nth(index).blur();
  }

  await expect(months.getByText('Total pe perioadă: 353,5 m³')).toBeVisible();
  // March left empty is named, not summed as nothing in silence.
  await expect(months.getByText(/1 lună este goală: mar\. 2026/u)).toBeVisible();
  await expect
    .poll(async () => (await calcLinesOf({ organizationId, reportId }))[0])
    .toMatchObject({ quantity: '353.5', monthlyQuantities: ['40', '45', null, '38', '30', '22', '18', '17', '21', '33', '41', '48.5'] });
});

test('each site is its own address, and the chips say how many lines it holds (§4.7, UX-4)', async ({ page }) => {
  const { reportId } = await signedInWithReport(page, 'sites');
  await openCalculator(page, reportId);
  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '500' });
  await addLine(page, { source: 'Lemne de foc', site: 'Magazinul', figure: '2,5' });

  const chips = page.getByRole('list', { name: 'Afișați liniile pentru' });
  await expect(chips.getByRole('link', { name: 'Toate locațiile · 2 linii' })).toHaveAttribute('aria-current', 'page');
  await chips.getByRole('link', { name: 'Magazinul · 1' }).click();
  await expect(page).toHaveURL(/\?site=1$/u);
  await expect(site(page, 'Magazinul')).toBeVisible();
  await expect(site(page, 'Brutăria')).toHaveCount(0);

  // Restored from the address alone, as a colleague sent the link would see it.
  await openCalculator(page, reportId, '?site=1');
  await expect(site(page, 'Brutăria')).toHaveCount(0);
});

/**
 * 39.2 — what the lines come to, how, and the hand-back to B3 (UC-33, UX-42, UX-44). The figures are the shipped set's
 * own: 500 m³ of gas is 4.78865 MWh and 0.9699123256 t, shown to the configured two places.
 */
const SCOPE_1 = 'GrossScope1GreenhouseGasEmissions';
const summary = (page: Page) => page.getByRole('region', { name: 'Ce se transmite în B3' });

test('the figures follow the lines, the derivation opens at its own address, and using them hands back to B3 (UC-33, UX-42)', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'results');
  await openCalculator(page, reportId);
  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '500' });

  const bakery = site(page, 'Brutăria');
  // Converted and emitted, once the server has the line — rounded once, to the configured places.
  await expect(bakery.getByText('4,79 MWh', { exact: true })).toBeVisible();
  await expect(bakery.getByText('0,97 t CO₂e', { exact: true })).toBeVisible();
  await expect(summary(page).getByText('0,97 t CO₂e', { exact: true })).toBeVisible();
  // Nothing reached B3 yet: the totals follow the lines, and B3 waits for the button.
  expect(await disclosureValueOf({ organizationId, reportId, elementKey: SCOPE_1 })).toBeNull();

  // UX-42: four steps in place, the conversion and the factor exactly as the set publishes them, and an address.
  await bakery.getByRole('link', { name: 'Cum', exact: true }).click();
  await expect(page).toHaveURL(/[?&]line=[0-9a-f-]{36}/u);
  await expect(bakery.getByText('Convertit în energie')).toBeVisible();
  await expect(bakery.getByText(/0,0095773 MWh per m³/u)).toBeVisible();
  await expect(bakery.getByText(/0,202544 t CO₂e per MWh/u)).toBeVisible();
  await expect(bakery.getByText('Setul de factori folosit: 2026.1')).toBeVisible();

  await summary(page).getByRole('button', { name: 'Folosiți aceste cifre în B3' }).click();
  await page.waitForURL(`**/reports/${reportId}/B3`);
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: SCOPE_1 }))
    .toMatchObject({ valueNumeric: '0.9699123256' });
  // Landing in the field marked as calculated (task 36.4's marker).
  await expect(
    page.getByRole('group', { name: 'Emisii brute de gaze cu efect de seră din domeniul de aplicare 1', exact: true })
      .getByText('Calculat', { exact: true }),
  ).toBeVisible();
});

test('B3 opens the calculator, for both of its scopes at once (S-09’s entry point)', async ({ page }) => {
  const { reportId } = await signedInWithReport(page, 'entry-point');
  await page.goto(`/reports/${reportId}/B3`);
  await page.getByRole('link', { name: 'Calculați din facturile mele' }).click();
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}/calculator$`, 'u'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Energia dumneavoastră, în unitățile de pe facturi');
});

test('the figures wait while a line is unsent, and say why, rather than leaving the line out (task 39.2)', async ({ page, context }) => {
  const { reportId } = await signedInWithReport(page, 'waits');
  await openCalculator(page, reportId);
  await context.setOffline(true);
  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '500' });
  // A line the server has not seen has no figure to show — waiting, never a zero.
  await expect(site(page, 'Brutăria').getByText('Se așteaptă conversia')).toBeVisible();
  await expect(summary(page).getByRole('button', { name: 'Folosiți aceste cifre în B3' })).toBeDisabled();
  await expect(summary(page).getByText(/Fără conexiune/u)).toBeVisible();
  await context.setOffline(false);
  await expect(summary(page).getByRole('button', { name: 'Folosiți aceste cifre în B3' })).toBeEnabled();
});

test('a newer set in force than B3’s figures used is named, with each figure now and would be (UX-44)', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'newer');
  await openCalculator(page, reportId);
  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '500' });
  await expect(site(page, 'Brutăria').getByText('0,97 t CO₂e', { exact: true })).toBeVisible();
  // B3's figures as an earlier set computed them — a pin no artefact in force holds.
  await seedCalcRun({ organizationId, reportId, revision: 999_999, results: [{ elementKey: SCOPE_1, tonnesCo2e: '0.95' }] });

  await page.reload();
  const notice = page.getByRole('alert').filter({ hasText: 'Sunt în vigoare factori de emisie mai noi' });
  await expect(notice).toBeVisible();
  await expect(notice.getByText(/calculate cu un set de factori anterior/u)).toBeVisible();
  await expect(notice.getByRole('row', { name: /Domeniul 1 · combustibil ars 0,95 t CO₂e 0,97 t CO₂e/u })).toBeVisible();
  await notice.getByRole('button', { name: 'Recalculați cu 2026.1' }).click();
  await page.waitForURL(`**/reports/${reportId}/B3`);
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: SCOPE_1 }))
    .toMatchObject({ valueNumeric: '0.9699123256' });
});

/**
 * 39.3 — UC-34 from the browser: a line's tonnes replaced on S-09, a B3 scope replaced and explained on S-07, each with
 * the reason required **and said** when it is missing, both figures shown together, and the computed figure put back in
 * one action (UX-43).
 */
const SCOPE_1_FIELD = 'Emisii brute de gaze cu efect de seră din domeniul de aplicare 1';
const TOTAL_FIELD = 'Emisii brute totale de GES din domeniile de aplicare 1 și 2, pe bază de amplasare';

/** The reason left blank: invalid, described by the message that says why — and nothing sent. */
async function expectReasonRefused(region: Locator): Promise<void> {
  const reason = region.getByLabel('De ce o înlocuiți?');
  await expect(reason).toHaveAttribute('aria-invalid', 'true');
  await expect(reason).toHaveAccessibleDescription(/Spuneți de ce înlocuiți cifra calculată/u);
}

test('a line’s tonnes are replaced with a reason the form asks for, both figures stay, and the computed one comes back (UC-34)', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'line-override');
  await openCalculator(page, reportId);
  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '500' });
  const bakery = site(page, 'Brutăria');
  await expect(bakery.getByText('0,97 t CO₂e', { exact: true })).toBeVisible();

  await bakery.getByRole('button', { name: 'Înlocuiți cu cifra mea' }).click();
  await bakery.getByLabel('Cifra dumneavoastră, în tone de CO₂e').fill('0,84');
  await bakery.getByRole('button', { name: 'Folosiți cifra mea' }).click();
  // No reason, no substitution — and the form says why on the field itself, rather than refusing in silence.
  await expectReasonRefused(bakery);
  expect((await calcLinesOf({ organizationId, reportId }))[0]?.overrideTonnes).toBeNull();

  await bakery.getByLabel('De ce o înlocuiți?').fill('O dubă a fost subînchiriată din martie.');
  await bakery.getByRole('button', { name: 'Folosiți cifra mea' }).click();
  await expect
    .poll(async () => (await calcLinesOf({ organizationId, reportId }))[0])
    .toMatchObject({ overrideTonnes: '0.84', overrideExplanation: 'O dubă a fost subînchiriată din martie.' });
  // Both figures, and the reason, together (UX-43).
  await expect(bakery.getByText('0,84 t CO₂e', { exact: true })).toBeVisible();
  await expect(bakery.getByText('cifra dumneavoastră', { exact: true })).toBeVisible();
  await expect(bakery.getByText(/Cifra calculată de 0,97 t CO₂e a fost înlocuită/u)).toBeVisible();
  // And who replaced it, named on the figure (task 39.4; FR-36).
  await expect(bakery.getByText('Înlocuită de Ana Popescu.', { exact: true })).toBeVisible();
  await expect(bakery.getByText('O dubă a fost subînchiriată din martie.')).toBeVisible();

  await bakery.getByRole('button', { name: 'Reveniți la cifra calculată' }).click();
  await expect.poll(async () => (await calcLinesOf({ organizationId, reportId }))[0]?.overrideTonnes).toBeNull();
  await expect(bakery.getByText('0,97 t CO₂e', { exact: true })).toBeVisible();
  await expect(bakery.getByText('cifra dumneavoastră', { exact: true })).toHaveCount(0);
  await expect(bakery.getByText('Înlocuită de Ana Popescu.', { exact: true })).toHaveCount(0);
});

test('a B3 scope is replaced and explained on S-07, both figures shown, and put back in one action (UC-34, UX-43)', async ({ page }) => {
  const { reportId, organizationId } = await signedInWithReport(page, 'b3-override');
  await openCalculator(page, reportId);
  await addLine(page, { source: 'Gaze naturale', site: 'Brutăria', figure: '500' });
  // Both scopes, so the total B3 derives from them has a figure to show (task 38.4's `sum` answers none over a gap).
  await addLine(page, { source: 'Electricitate din rețea', site: 'Magazinul', figure: '17000', unit: 'kWh' });
  await summary(page).getByRole('button', { name: 'Folosiți aceste cifre în B3' }).click();
  await page.waitForURL(`**/reports/${reportId}/B3`);

  const scope1 = page.getByRole('group', { name: SCOPE_1_FIELD, exact: true });
  const total = page.getByRole('group', { name: TOTAL_FIELD, exact: true });
  // Rounded once to the configured places (§12.5.6's task-39 row (7)), and not typed over — the derived total too,
  // which the step's ordinary read-only arm draws.
  await expect(scope1.getByText('0,97 t CO₂e', { exact: true })).toBeVisible();
  await expect(scope1.getByRole('textbox')).toHaveCount(0);
  await expect(total.getByText('11,08', { exact: true })).toBeVisible();

  await scope1.getByRole('button', { name: 'Explicați această cifră' }).click();
  await scope1.getByLabel('O notă lângă cifră').fill('Magazinul din Cahul este facturat de proprietar.');
  await scope1.getByRole('button', { name: 'Salvați nota' }).click();
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: SCOPE_1 }))
    .toMatchObject({ origin: 'calculated', explanation: 'Magazinul din Cahul este facturat de proprietar.' });
  await expect(scope1.getByText(/Magazinul din Cahul este facturat de proprietar/u)).toBeVisible();

  await scope1.getByRole('button', { name: 'Înlocuiți cu cifra mea' }).click();
  await scope1.getByLabel('Cifra dumneavoastră, în tone de CO₂e').fill('1,75');
  await scope1.getByRole('button', { name: 'Folosiți cifra mea' }).click();
  await expectReasonRefused(scope1);
  expect(await disclosureValueOf({ organizationId, reportId, elementKey: SCOPE_1 })).toMatchObject({ origin: 'calculated' });
  await scope1.getByLabel('De ce o înlocuiți?').fill('Cifra contabilului, din citiri ale contorului.');
  await scope1.getByRole('button', { name: 'Folosiți cifra mea' }).click();
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: SCOPE_1 }))
    .toMatchObject({ origin: 'overridden', valueNumeric: '1.75', explanation: 'Cifra contabilului, din citiri ale contorului.' });
  await expect(scope1.getByText('Cifra dumneavoastră: 1,75 t CO₂e')).toBeVisible();
  await expect(scope1.getByText('Calculată: 0,97 t CO₂e — înlocuită')).toBeVisible();
  await expect(scope1.getByText('Înlocuită de Ana Popescu.', { exact: true })).toBeVisible();
  await expect(scope1.getByText('Cifra dumneavoastră', { exact: true })).toBeVisible();
  // The total is derived over the substitute, not the computed figure: 1.75 + 10.108965.
  await expect(total.getByText('11,86', { exact: true })).toBeVisible();

  await scope1.getByRole('button', { name: 'Reveniți la cifra calculată' }).click();
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: SCOPE_1 }))
    .toMatchObject({ origin: 'calculated', valueNumeric: '0.9699123256' });
  await expect(scope1.getByText('0,97 t CO₂e', { exact: true })).toBeVisible();
});
