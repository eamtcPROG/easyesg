import { expect, test, type Locator, type Page } from '@playwright/test';
import { cleanupAccounts, cleanupOrganizations, grantMembership, seedReport, verificationTokenFor } from './support/db';
import { untilHydrated } from './support/hydration';

/**
 * Validation on S-07 and S-08 (task 42; FR-40 … FR-43; `architecture.md` §12.5.6's task-42 row).
 *
 * **42.1 — a field's verdict at the point of entry, live.** The browser evaluates every rule the open step can, with the
 * api's own interpreter, over the answers the wizard holds — so a verdict appears and clears as the reporter answers,
 * before any run (FR-43 item 6). Only a browser can show that: the interpreter's verdicts are the shared corpus's, and
 * what is claimed here is that they reach the field, in the reader's words, as the reporter leaves it.
 *
 * **42.2 — S-08, and the lists that read the run.** *Check my report* runs, the panel lists what the run found by
 * module with the same words the field shows, and S-07's list, S-06 and S-05 read the run's roll-up — and before a
 * first run say it was never checked.
 *
 * **42.3 — a finding is its field's address.** Followed from S-08 to another step, followed in place on the open one,
 * opened directly, or followed from the sheet below `wide`: each lands focus in the field's control, with the finding's
 * words beside it. Only a browser can say where focus is.
 */
const RUN_PREFIX = `e2e-web-validation-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(
  page: Page,
  label: string,
  role: 'organization_administrator' | 'editor' | 'viewer' = 'organization_administrator',
): Promise<string> {
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

  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}`, role });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity` });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return reportId;
}

/** The three parts of `validation.required`, as the shared catalogue words them in Romanian — one sentence each. */
const REQUIRED_WORDS =
  'Această întrebare nu are încă un răspuns. Raportul are nevoie de el, așa că nu este complet fără el. ' +
  'Răspundeți la ea sau marcați-o ca indisponibilă, indicând motivul.';

/**
 * **Turnover, because it has no default.** A question the template defaults is answered on arrival — the step commits
 * the default it shows (task 42.2) — so it is never missing, and the basis question these journeys first used was one.
 */
const TURNOVER = 'Cifra de afaceri';

/** Blur is the commit (FR-37): wait for React to hold the input, fill it, then move focus away. */
async function answerTurnover(page: Page, value: string): Promise<void> {
  const input = page.getByRole('textbox', { name: TURNOVER, exact: true });
  await untilHydrated(input);
  await input.fill(value);
  await input.press('Tab');
}

test('a required field says what is missing where it is answered, and stops once it is — no run (FR-40 AC-1, AC-2)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'required');
  await page.goto(`/reports/${reportId}/B1`);

  // The field, not the input inside it: the anatomy's group, named by the question.
  const turnover = page.getByRole('group', { name: TURNOVER, exact: true });
  // §6.4's attention marker and the finding's three parts, in the field — the report has never been checked, so this
  // is the browser's own verdict.
  await expect(turnover.getByText('De completat', { exact: true })).toHaveCount(1);
  await expect(turnover.getByText(REQUIRED_WORDS, { exact: true })).toHaveCount(1);

  await answerTurnover(page, '1000');
  // Answered, so the finding is gone with no run in between — live (FR-43 item 6).
  await expect(turnover.getByText(REQUIRED_WORDS, { exact: true })).toHaveCount(0);
  await expect(turnover.getByText('De completat', { exact: true })).toHaveCount(0);
});

test('an address that is not one is flagged by its form, quoted as typed, and cleared once corrected (FR-40 AC-13)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'url');
  await page.goto(`/reports/${reportId}/B1`);

  // The link is asked only once the report says it carries unchanged disclosures (B1's condition).
  await page
    .getByRole('radiogroup', {
      name: 'Raportul conține informații din perioada de raportare anterioară care rămân nemodificate',
    })
    .getByRole('radio', { name: 'Da' })
    .check();
  const link = page.getByRole('group', {
    name: 'Linkul către raportul anterior care conține informațiile rămase nemodificate',
    exact: true,
  });
  const address = link.getByRole('textbox');
  await address.fill('www.example.md/raport');
  await address.blur();

  // The error role's marker, and the address quoted verbatim — a bare `www.` is not an absolute address (task-40 row).
  await expect(link.getByText('Adresă invalidă', { exact: true })).toHaveCount(1);
  await expect(link.getByText(/Adresa „www\.example\.md\/raport” nu este o adresă web completă\./u)).toHaveCount(1);

  await address.fill('https://example.md/raport');
  await address.blur();
  await expect(link.getByText('Adresă invalidă', { exact: true })).toHaveCount(0);
});

const PANEL = 'Verificarea raportului';

test('S-08 checks the report when asked, lists what it found by module, and the list reads the run (UC-38, UC-40; FR-41 AC-5)', async ({
  page,
}) => {
  // Docked beside the step from the shell's side-by-side width.
  await page.setViewportSize({ width: 1440, height: 900 });
  const reportId = await signedInWithReport(page, 'panel');
  await page.goto(`/reports/${reportId}/B1`);

  const panel = page.getByRole('region', { name: PANEL });
  // Never checked: the panel says so, and the list says nothing a run has not counted (row (3)).
  await expect(panel.getByText('Nicio verificare încă', { exact: true })).toHaveCount(1);
  const rail = page.getByRole('navigation', { name: 'Secțiunile raportului' });
  // The group's count, beside its name: no run has counted the Basic Module.
  await expect(rail.locator('p', { hasText: 'Modulul de bază' })).toContainText('Neverificat încă');

  const check = panel.getByRole('button', { name: 'Verificați raportul' });
  await untilHydrated(check);
  await check.click();
  await expect(panel.getByText(/^Ultima verificare: /u)).toHaveCount(1);

  // B1's group, headed as the list names B1, holding turnover's finding in the field's own three parts.
  const b1 = panel.getByRole('list', { name: 'B1 — Baza de întocmire' });
  const turnover = b1.getByRole('listitem').filter({ hasText: TURNOVER });
  await expect(turnover).toHaveCount(1);
  await expect(turnover.getByText('De corectat', { exact: true })).toHaveCount(1);
  await expect(turnover.getByText(REQUIRED_WORDS, { exact: true })).toHaveCount(1);
  await expect(turnover.getByRole('link', { name: 'Mergeți la câmp' })).toHaveCount(1);
  // The list now reads the run: B1 alone is in progress, its count the run's, and the group counts what the run found.
  await expect(rail.getByRole('list', { name: 'Modulul de bază' }).getByText(/^În lucru · /u)).toHaveCount(1);
  await expect(rail.locator('p', { hasText: 'Modulul de bază' })).toContainText(/0 din \d+ finalizate/u);

  // Answered, the finding stays in view, weighed cleared since the last check — no run in between (row (c)).
  await answerTurnover(page, '1000');
  await expect(turnover.getByText('Rezolvat de la ultima verificare', { exact: true })).toHaveCount(1);

  // S-06 and S-05 draw the same run's summary (FR-25 AC-3, FR-23 AC-7; row (f)).
  await page.goto('/reports');
  await expect(page.getByText(/^0 din \d+ module finalizate$/u)).toHaveCount(1);
  // S-05 lists the filing twice — needing attention, and among everything — and both rows say the same.
  await page.goto('/home');
  await expect(page.getByText(/^0 din \d+ module finalizate$/u)).toHaveCount(2);
});

test('S-08 offers a view-only member the findings and no run (182/22)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const reportId = await signedInWithReport(page, 'viewer', 'viewer');
  await page.goto(`/reports/${reportId}/B1`);

  const panel = page.getByRole('region', { name: PANEL });
  await expect(panel.getByText(/Un editor sau administratorul organizației îl poate verifica\./u)).toHaveCount(1);
  await expect(panel.getByRole('button', { name: 'Verificați raportul' })).toHaveCount(0);
});

test('below the docked width S-08 is a count at the step’s foot that raises the panel as a sheet (S-07/S-08 narrow)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reportId = await signedInWithReport(page, 'sheet');
  await page.goto(`/reports/${reportId}/B1`);

  // Not docked: the region is not in the tree until the sheet is raised.
  await expect(page.getByRole('region', { name: PANEL })).toHaveCount(0);
  const count = page.getByRole('button', { name: 'Raportul nu a fost încă verificat' });
  await untilHydrated(count);
  await count.click();
  const sheet = page.getByRole('dialog', { name: PANEL });
  await sheet.getByRole('button', { name: 'Verificați raportul' }).click();
  await expect(sheet.getByText(/^Ultima verificare: /u)).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Închideți verificarea raportului' }).click();
  // Closed, the count now says what the run found.
  await expect(page.getByRole('button', { name: /^De corectat: \d+ · De revizuit: \d+$/u })).toHaveCount(1);
});

/** The address of a field with no dimension and no member — its step's, with the field's anchor (task 42.3). */
const TURNOVER_ANCHOR = 'disclosure-Turnover--0';
const EMPLOYEES = 'Numărul de angajați';

/** *Check my report*, pressed once the panel can take it, and the run's heading awaited. */
async function checkReport(scope: Locator): Promise<void> {
  const check = scope.getByRole('button', { name: 'Verificați raportul' });
  await untilHydrated(check);
  await check.click();
  await expect(scope.getByText(/^Ultima verificare: /u)).toHaveCount(1);
}

/** A finding's row in a module's group, by the field it names — exactly, since one label can begin another. */
const findingRow = (group: Locator, field: string) =>
  group.getByRole('listitem').filter({ has: group.page().getByText(field, { exact: true }) });

test('a finding leads to its field — from another step, in place, and by its address — with focus in it (FR-42 AC-1 … AC-4)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const reportId = await signedInWithReport(page, 'to-field');
  await page.goto(`/reports/${reportId}/B2`);
  const panel = page.getByRole('region', { name: PANEL });
  await checkReport(panel);

  // From B2, a B1 finding is B1's address with the field's anchor, and lands focus in the field's control (AC-4).
  const b1 = panel.getByRole('list', { name: 'B1 — Baza de întocmire' });
  await findingRow(b1, TURNOVER).getByRole('link', { name: 'Mergeți la câmp' }).click();
  await page.waitForURL(`**/reports/${reportId}/B1#${TURNOVER_ANCHOR}`);
  const turnover = page.getByRole('textbox', { name: TURNOVER, exact: true });
  await expect(turnover).toBeFocused();
  // Focus moved, not a scroll alone, and the finding's words are there beside it (AC-1, AC-2).
  await expect(page.getByRole('group', { name: TURNOVER, exact: true }).getByText(REQUIRED_WORDS, { exact: true })).toHaveCount(1);

  // On the open step, another of its findings moves focus in place — no step change (AC-1).
  const onB1 = page.getByRole('region', { name: PANEL }).getByRole('list', { name: 'B1 — Baza de întocmire' });
  await findingRow(onB1, EMPLOYEES).getByRole('link', { name: 'Mergeți la câmp' }).click();
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}/B1#disclosure-`, 'u'));
  await expect(page.getByRole('textbox', { name: EMPLOYEES, exact: true })).toBeFocused();

  // The address opened directly lands the same way (AC-3).
  await page.goto(`/reports/${reportId}/B2`);
  await page.goto(`/reports/${reportId}/B1#${TURNOVER_ANCHOR}`);
  await expect(page.getByRole('textbox', { name: TURNOVER, exact: true })).toBeFocused();
});

test('a finding followed from the sheet closes it and leaves focus in the field (FR-42 AC-1; S-07/S-08 narrow)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reportId = await signedInWithReport(page, 'sheet-to-field');
  await page.goto(`/reports/${reportId}/B1`);

  const count = page.getByRole('button', { name: 'Raportul nu a fost încă verificat' });
  await untilHydrated(count);
  await count.click();
  const sheet = page.getByRole('dialog', { name: PANEL });
  await checkReport(sheet);

  await findingRow(sheet.getByRole('list', { name: 'B1 — Baza de întocmire' }), TURNOVER)
    .getByRole('link', { name: 'Mergeți la câmp' })
    .click();
  await expect(page.getByRole('dialog', { name: PANEL })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#${TURNOVER_ANCHOR}$`, 'u'));
  await expect(page.getByRole('textbox', { name: TURNOVER, exact: true })).toBeFocused();
});
