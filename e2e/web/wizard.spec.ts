import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  disclosureValueOf,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * S-07's shell (task 35.1) — the one claim the deliverable makes: **B1–B11 navigable, and every step
 * has a URL that restores it.**
 *
 * UX-4 requires every addressable state to be addressable, and a wizard whose step lives in
 * component state fails it invisibly: it navigates perfectly until someone bookmarks a step, follows
 * a validation deep link (UX-22) or resumes on another device (FR-39). Only a browser can tell the
 * two implementations apart, which is why this journey exists rather than a unit test.
 *
 * **The report is seeded rather than created through the product**, because there is no way in yet:
 * S-06 is task 32.2.2 and blocked on task 36, and report creation is task 32.3. Stated here so the
 * fixture reads as the gap it is rather than as a shortcut.
 */
const RUN_PREFIX = `e2e-web-wizard-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];
/** Which organization a seeded report belongs to, so a case can read the store back under RLS. */
const organizationOf = new Map<string, string>();

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(
  page: Page,
  label: string,
  sites?: readonly { readonly name: string; readonly locality: string }[],
): Promise<string> {
  const email = addressFor(label);

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-${label}`,
  });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity`, ...(sites ? { sites } : {}) });
  organizationOf.set(reportId, organizationId);

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  return reportId;
}

test('opens at a step, moves between modules, and every step restores from its URL (S-07, UX-4, UX-10)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'rc');

  // UX-10: opening a report places the reporter at the first incomplete step, and that step has its
  // own address from the first moment rather than after a client-side decision.
  await page.goto(`/reports/${reportId}`);
  await page.waitForURL(`**/reports/${reportId}/B1`);

  const rail = page.getByRole('navigation', { name: 'Secțiunile raportului' });
  await expect(rail.getByRole('link', { name: 'B1', exact: true })).toBeVisible();
  await expect(rail.getByRole('link', { name: 'C9', exact: true })).toBeVisible();

  // The current step is announced, not merely coloured — a rail that showed position visually only
  // would leave a screen-reader user unable to tell which of twenty modules they are in (NFR-75).
  await expect(page.getByRole('listitem').filter({ hasText: 'B1' }).first()).toHaveAttribute(
    'aria-current',
    'step',
  );

  await rail.getByRole('link', { name: 'B3', exact: true }).click();
  await page.waitForURL(`**/reports/${reportId}/B3`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B3');

  // The claim itself: the URL alone restores the step. A wizard holding its position in React state
  // passes every assertion above and fails this one.
  await page.goto(`/reports/${reportId}/B7`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B7');
  await expect(page.getByRole('listitem').filter({ hasText: 'B7' }).first()).toHaveAttribute(
    'aria-current',
    'step',
  );

  // UX-5's single, always-visible way out, which states that work is saved.
  await expect(page.getByRole('link', { name: /Ieșiți din raport/ })).toBeVisible();
});

test('answers a module the pinned taxonomy does not carry with a 404, not an empty shell', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'rc404');

  const response = await page.goto(`/reports/${reportId}/B99`);
  expect(response?.status()).toBe(404);
});

/**
 * B1 in a browser (task 36.2; UC-19, FR-24, FR-27, FR-28).
 *
 * What only this level can show: that the pre-filled values a reporter accepts **reach the store**,
 * that a typed axis reads as *Amplasament 1* rather than five interleaved questions, and that a
 * choice field offers the taxonomy's members instead of a text box. Each is a rendering the api
 * tests cannot see and the unit tests cannot compose.
 */
test('opens B1 pre-filled, stores what the reporter accepts, and groups the sites (FR-27, UX-109)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'b1', [
    { name: 'Hala', locality: 'Chișinău' },
    { name: 'Depozit', locality: 'Bălți' },
  ]);
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B1`);

  // Two sites from the snapshot, each its own group — the reading a flat list cannot give.
  const first = page.getByRole('group', { name: 'Amplasament 1' });
  const second = page.getByRole('group', { name: 'Amplasament 2' });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  // The site's LOCALITY, named — not `.first()` on the group. The fixture's snapshot carries a
  // locality and no address, so the first textbox is legitimately empty and a positional locator
  // would be asserting on whichever field the standard happens to order first.
  await expect(first.getByRole('textbox', { name: 'Localitatea amplasamentului' })).toHaveValue('Chișinău');
  await expect(second.getByRole('textbox', { name: 'Localitatea amplasamentului' })).toHaveValue('Bălți');

  // FR-27's other half: the defaults the reporter did not touch are stored on arrival, so a B1
  // nobody edited is still a B1 that was filed. The indicator is the screen's own claim; the store
  // is the fact (NFR-56).
  // The indicator by its region, not by its words: *"Salvat"* also appears inside the exit link's
  // own sentence — *"lucrul este salvat"* — and a text locator matches both (found by strict mode,
  // 3 Sep 2026). UX-35 puts the state in one fixed location, and this is that location.
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({ organizationId, reportId, elementKey: 'CityOfSite' }))?.valueText,
      { timeout: 15_000 },
    )
    .toBe('Chișinău');
});

test('offers a choice field the taxonomy’s own members, not a text box (task 91.1)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b1choice', [{ name: 'Hala', locality: 'Chișinău' }]);

  await page.goto(`/reports/${reportId}/B1`);

  // `UndertakingsLegalForm` is an enumeration. Until task 36.2 every one of B1's ten choice fields
  // rendered as free text, which the api's members made answerable and nothing on the screen used —
  // so this asserts the ROLE, which is the only thing that tells the two implementations apart.
  const legalForm = page.getByRole('combobox', { name: 'Forma juridică a întreprinderii' });
  await expect(legalForm).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Forma juridică a întreprinderii' })).toHaveCount(0);

  // And its members are the domain's, worded — not member keys, which no reader may be shown.
  await legalForm.click();
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();
  for (const text of await options.allInnerTexts()) expect(text).not.toContain('Member');
});

test('counts a narrative field’s length, and imposes no limit on it (UX-19)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b1text', [{ name: 'Hala', locality: 'Chișinău' }]);

  await page.goto(`/reports/${reportId}/B1`);
  const narrative = page.getByRole('textbox', {
    name: 'Descrierea certificărilor sau etichetelor legate de sustenabilitate',
  });
  await narrative.fill('ISO 14001');

  // The count is the half of UX-19 that has a source; the soft target is deferred with no corpus.
  await expect(page.getByText('9 caractere')).toBeVisible();
  await expect(narrative).not.toHaveAttribute('maxlength', /.+/u);
});

test('a module the rules ruled out says so on the rail rather than counting to zero (FR-28)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'b1rules', [{ name: 'Hala', locality: 'Chișinău' }]);

  await page.goto(`/reports/${reportId}/B1`);
  const rail = page.getByRole('navigation', { name: 'Secțiunile raportului' });

  // **B6's own item**, not the first match on the rail: the test is named for B6, and a rail-wide
  // text locator would keep passing if B6's applicability broke while another module happened to
  // show the same words (convention review, 3 Sep 2026 — `.first()` is a finding, not a style).
  const b6 = rail.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'B6', exact: true }) });
  await expect(b6).toHaveText(/Nu se aplică/u);
  // And it is the only module in that state on an untouched B1, which is what makes the assertion
  // above about B6 rather than about the rail.
  await expect(rail.getByText('Nu se aplică')).toHaveCount(1);
});
