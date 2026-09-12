import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedOpenPeriod,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded } from './support/expansion';

/**
 * S-05 at +40% (UX-94, UX-73's three frames; task 30.5).
 *
 * The screen every sign-in lands on, and the one whose content is mostly *sentences* — an empty
 * state's explanation, an arrival notice, a membership row carrying a legal name and a role. Padded
 * 40%, those are what push a layout sideways if anything is going to.
 *
 * **Task 32.4 seeds two filings, because the padded row is now the widest thing here.** A filing
 * row carries a legal name, an ISO date range, two status chips and a link on one line — five
 * things competing for the same width, where the membership row it is modelled on carries three.
 * Running this against the empty state would pad an `EmptyState` and prove nothing about the
 * layout the task actually added.
 */
const RUN_PREFIX = `e2e-web-home-x-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string): Promise<string> {
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

  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-${label}`,
  });
  organizations.push(organizationId);

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return organizationId;
}

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`S-05 tolerates +40% at ${frame.width}`, async ({ page }) => {
    const organizationId = await signedIn(page, `x${frame.width}`);
    // One started filing and one nobody has begun, so every region renders: attention, resume, and
    // the whole-organization list. A long legal name, because that is what a filing row wraps on.
    await seedReport({
      organizationId,
      name: `${RUN_PREFIX}-Întreprinderea de panificație`,
      fiscalYear: 2024,
      dueDate: '2025-04-30',
    });
    await seedOpenPeriod({
      organizationId,
      name: `${RUN_PREFIX}-Moara de făină`,
      fiscalYear: 2025,
    });
    await page.setViewportSize(frame);
    // With the arrival notice showing, which is the widest the screen ever is.
    await page.goto('/home?joined=already_member');

    await expect(page.getByRole('heading', { name: exactlyPadded('Ce necesită atenție') })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}
