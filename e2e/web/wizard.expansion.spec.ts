import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded } from './support/expansion';

/**
 * S-07 at +40% (UX-94, UX-73's three frames; task 35.2).
 *
 * The step's own header carries two things whose length the pattern sets: the save-state indicator
 * in its fixed location, and the exit control's sentence beside it. Padded 40%, those are what push
 * the header onto a second line or the page sideways — and the indicator's location is the whole
 * of UX-35's "one fixed location", so it is the thing to hold at every width.
 */
const RUN_PREFIX = `e2e-web-wizard-x-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(page: Page, label: string): Promise<string> {
  const email = `${RUN_PREFIX}-${label}@example.md`;

  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity` });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  return reportId;
}

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`S-07 tolerates +40% at ${frame.width}`, async ({ page }) => {
    const reportId = await signedInWithReport(page, `x${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto(`/reports/${reportId}/B1`);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('status', { name: exactlyPadded('Starea salvării') })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ieșiți din raport/u })).toBeVisible();

    // **A disclosure's own label, padded** (task 51.3). Every question on this step is wording the
    // *api* resolves from the version the report pins (OQ-58), by its own path — so until the api
    // was padded too, the check above measured a padded shell around Romanian-length questions and
    // could not have failed on them. Naming one label is what keeps this case honest: without it the
    // overflow check still passes when no question is on screen at all.
    //
    // **The group, not the text.** That label is on screen twice by design and the first draft of
    // this line matched both: `DisclosureField` renders the visible `<span>` its group is named by,
    // and the `Select` inside keeps its own label clipped so the control has an accessible name of
    // its own. Naming the group says which one this case means, where a `.first()` would have
    // recorded the ambiguity instead of resolving it.
    await expect(
      page.getByRole('group', {
        name: exactlyPadded('Baza de întocmire (numai Modulul de bază sau Modulul de bază și cel cuprinzător)'),
      }),
    ).toBeVisible();
  });
}
