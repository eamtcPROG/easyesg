import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedCalcLine,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded } from './support/expansion';

/**
 * S-09 at +40% (UX-94, UX-73's three frames; task 39.1).
 *
 * What the calculator adds to the wizard's shell, and what padding pushes sideways first: the site chips, a line's
 * source name and scope beside its figure, and the monthly form's twelve labelled rows with the sentence naming the
 * months left empty. The lines are seeded, not typed — the subject is how they are drawn — and one of them is monthly,
 * so the widest part of the screen is on it in every frame.
 */
const RUN_PREFIX = `e2e-web-calculator-x-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithLines(page: Page, label: string): Promise<string> {
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
  const reportId = await seedReport({
    organizationId,
    name: `${RUN_PREFIX}-entity`,
    sites: [
      { name: 'Brutăria', locality: 'Chișinău' },
      { name: 'Magazinul', locality: 'Cahul' },
    ],
  });
  await seedCalcLine({
    organizationId,
    reportId,
    siteOrdinal: 0,
    sourceKey: 'natural_gas',
    quantity: '123',
    unitCode: 'm3',
    monthlyQuantities: ['40', '45', null, '38', null, null, null, null, null, null, null, null],
  });
  await seedCalcLine({ organizationId, reportId, siteOrdinal: 1, sourceKey: 'electricity_grid', quantity: '17000', unitCode: 'kWh' });

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
  test(`S-09 tolerates +40% at ${frame.width}`, async ({ page }) => {
    const reportId = await signedInWithLines(page, `x${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto(`/reports/${reportId}/calculator`);

    // The calculator's own padded words are on screen — otherwise the overflow check below measures nothing of it.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      exactlyPadded('Energia dumneavoastră, în unitățile de pe facturi'),
    );
    // The legend names its line, and the line's name is padded inside it as well as the sentence around it.
    await expect(page.getByRole('group', { name: /^Gaze naturale·+, lună de lună·+$/u })).toBeVisible();
    await expect(page.getByText(exactlyPadded('Electricitate din rețea'))).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
