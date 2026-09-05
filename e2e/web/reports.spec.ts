import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedOpenPeriod,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * S-06 and its creation flow in a real browser (UC-17, UC-18; FR-25, FR-26 — tasks 32.2.2, 32.3).
 *
 * **What only a browser can prove here is that the Index's exit actually arrives.** Task 32.2.2 was
 * `BLOCKED` for one reason: §4.4 has no report record screen, so a row's only destination is the
 * wizard, and pointing the busiest list in the product at a redirector that rendered nothing is the
 * dead row action task 30.1 ruled against. Tasks 35.1 … 36.2 built that exit — and *"the link
 * resolves to a step"* is a claim about two screens and a redirect, which no unit test spans.
 *
 * The rest of the list is `reports.spec.ts`'s unit subject: the filter, the sort and the page
 * arithmetic are pure and every branch is asserted there, so this suite asserts what crosses a
 * boundary instead of re-asserting them through a slower surface.
 */
const RUN_PREFIX = `e2e-web-reports-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(
  page: Page,
  label: string,
  role?: 'editor' | 'viewer',
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
    ...(role ? { role } : {}),
  });
  organizations.push(organizationId);

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  return organizationId;
}

test('the index lists a report and its row opens the wizard (UC-17, and the exit that unblocked it)', async ({
  page,
}) => {
  const organizationId = await signedIn(page, 'index');
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-Brutăria` });

  // Reached through the workspace tier, not by typing the address: the nav entry is part of this
  // task, and §4.2's set holds only the sections that render.
  await page.getByRole('navigation', { name: 'Secțiunile organizației' })
    .getByRole('link', { name: 'Rapoarte' })
    .click();
  await page.waitForURL('**/reports');

  await expect(page.getByRole('heading', { level: 1, name: 'Rapoarte' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: `${RUN_PREFIX}-Brutăria` });
  await expect(row).toHaveCount(1);
  // The row names its entity and its year — task 32.2.1's whole reason, and the parent row's
  // deliverable in one assertion.
  // **Exact cells, not `toContainText`.** The row also renders `2026-01-01 – 2026-12-31` and
  // `2026-05-01`, so a substring assertion for the year holds even with an empty year cell — and
  // `scope.basic_and_comprehensive` *contains* "VSME Basic", so the loose form could not tell the
  // two scopes apart either. Both were true of the first draft.
  await expect(row.getByRole('cell', { name: '2026', exact: true })).toHaveCount(1);
  await expect(row.getByText('VSME Basic', { exact: true })).toHaveCount(1);
  // DR-4's pins on the screen rather than implied — **both**, which is what task 32.3's
  // "displays its pinned versions" asks for and what `.first()` would have hidden.
  await expect(row.getByText('2026-05-01', { exact: true })).toHaveCount(2);

  // **The claim the block was about.** The row's link goes to the report, and the report resolves
  // to a step — two screens and a redirect, which is exactly what did not exist before task 36.
  await row.getByRole('link', { name: `${RUN_PREFIX}-Brutăria` }).click();
  await page.waitForURL(`**/reports/${reportId}/B1`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B1');
});

test('the teaching empty state offers the first report, and the creation flow makes one (UC-18)', async ({
  page,
}) => {
  const organizationId = await signedIn(page, 'create');
  // An entity with a free period and no report: what the creation flow exists to offer.
  await seedOpenPeriod({ organizationId, name: `${RUN_PREFIX}-Aurora` });

  await page.goto('/reports');

  // §4.6: the Index's empty state teaches — it says what a report IS — and offers the first action.
  // Shipping this state with nothing to offer is why 32.3 was built in the same change.
  await expect(page.getByText('Niciun raport deocamdată')).toBeVisible();
  await page.getByRole('link', { name: 'Creați primul raport' }).click();
  await page.waitForURL('**/reports/new');

  // The two choices are links, so each one is an address (UX-4) — asserted by reloading on the
  // half-made choice rather than by trusting the component to have kept it.
  await page.getByRole('link', { name: `${RUN_PREFIX}-Aurora` }).click();
  await page.waitForURL(/\/reports\/new\?entity=/u);
  await page.getByRole('link', { name: '2026', exact: true }).click();
  await page.waitForURL(/period=/u);
  await page.reload();

  // **Task 32.3's deliverable: the pin is on the screen before the report exists.** DR-4 is only
  // checkable by a reader if it is shown, and this is the moment it decides what the report becomes.
  await expect(page.getByText('Șablon')).toBeVisible();
  await expect(page.getByText('Taxonomie')).toBeVisible();
  // **A count, not `.first()`.** Two pins are intended — template and taxonomy, which FR-69
  // migrates independently — so `.first()` would have left the assertion green with either one
  // gone, on the screen whose whole deliverable is that both are checkable.
  await expect(page.getByText('2026-05-01', { exact: true })).toHaveCount(2);

  // A period id that names nothing must not reach the write — a stale link, or a period that
  // gained a report since the page was opened. The confirm disappears rather than 409-ing.
  const chosen = new URL(page.url());
  const entityParam = chosen.searchParams.get('entity') ?? '';
  await page.goto(`/reports/new?entity=${entityParam}&period=00000000-0000-7000-8000-000000000000`);
  await expect(page.getByRole('button', { name: 'Creați raportul' })).toHaveCount(0);
  await page.goBack();

  await page.getByRole('button', { name: 'Creați raportul' }).click();
  // Straight into the wizard at the step work should start on — the created report carries the
  // period's pins, which the API copies rather than re-resolving (task 31.3).
  await page.waitForURL(/\/reports\/[0-9a-f-]+\/B1$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B1');

  // And it is on the list it was created from.
  await page.goto('/reports');
  await expect(page.getByRole('row').filter({ hasText: `${RUN_PREFIX}-Aurora` })).toHaveCount(1);
});

test('a filtered-to-nothing list offers the filter back, not the teaching state', async ({ page }) => {
  const organizationId = await signedIn(page, 'filter');
  await seedReport({ organizationId, name: `${RUN_PREFIX}-Lina` });

  // §4.6 requires the two empty states to be different screens, and this is the one a unit test
  // cannot see: the shell chooses between them from `matched` and `total`, and the choice is only
  // observable rendered.
  await page.goto('/reports?year=1999');

  await expect(page.getByText('Niciun raport nu corespunde filtrului')).toBeVisible();
  await expect(page.getByText('Niciun raport deocamdată')).toHaveCount(0);

  await page.getByRole('button', { name: 'Ștergeți filtrele' }).click();
  await expect(page.getByRole('row').filter({ hasText: `${RUN_PREFIX}-Lina` })).toHaveCount(1);
});

test('the screen is live in all three locales', async ({ page }) => {
  const organizationId = await signedIn(page, 'locales');
  await seedReport({ organizationId, name: `${RUN_PREFIX}-Locale` });

  await page.goto('/reports');
  await expect(page.getByRole('heading', { level: 1, name: 'Rapoarte' })).toBeVisible();

  await page.goto('/en/reports');
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();

  await page.goto('/ru/reports');
  await expect(page.getByRole('heading', { level: 1, name: 'Отчёты' })).toBeVisible();
});

/**
 * FR-25's other half: *"a view-only member sees the same entries and **no edit affordances**"*, and
 * §5's S-06 States row calls it `read-only (view-only membership)`.
 *
 * **Written because the refusal had no failing state**: every other journey here signs in as an
 * administrator, so deleting both `canCreate` branches changed nothing any test observed. The
 * entries are the assertion's other half — hiding the row as well as the button would be a
 * different defect satisfying the same "no button" check.
 */
test('a view-only member sees the reports and none of the writes (FR-25)', async ({ page }) => {
  const organizationId = await signedIn(page, 'viewer', 'viewer');
  await seedReport({ organizationId, name: `${RUN_PREFIX}-Viewer` });

  await page.goto('/reports');

  await expect(page.getByRole('row').filter({ hasText: `${RUN_PREFIX}-Viewer` })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Raport nou' })).toHaveCount(0);
});

/** The same clause on the empty state, whose action is the same write. */
test('a view-only member is taught what a report is, and offered no button (FR-25)', async ({
  page,
}) => {
  await signedIn(page, 'viewer-empty', 'viewer');

  await page.goto('/reports');

  await expect(page.getByText('Niciun raport deocamdată')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Creați primul raport' })).toHaveCount(0);
});
