import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupNotifications,
  cleanupOrganizations,
  grantMembership,
  seedNotices,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded } from './support/expansion';

/**
 * S-26 and the band's count at +40% (UX-94, UX-73's three frames; task 50.2.1).
 *
 * **The heading row is what widens first**: the title with its count, the lede, and at the row's end two tabs and
 * *Mark all as read*, three controls whose words grow with the rest. So the suite seeds an unread notice and a read
 * one — the tabs and *mark all* both render, and each item draws its time, its link and its two controls padded.
 */
const RUN_PREFIX = `e2e-web-notices-x-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupNotifications(organizations);
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string): Promise<void> {
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
  await seedNotices({
    organizationId,
    email,
    notices: [
      { deepLink: '/reports', minutesAgo: 3 },
      { deepLink: '/entities', minutesAgo: 60 * 26, read: true },
    ],
  });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`S-26 tolerates +40% at ${frame.width}`, async ({ page }) => {
    await signedIn(page, `x${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto('/notifications?show=all');

    await expect(page.getByRole('heading', { level: 1, name: exactlyPadded('Notificări') })).toBeVisible();
    await expect(page.getByRole('button', { name: exactlyPadded('Marcați toate ca citite') })).toBeVisible();
    await expect(
      page.getByRole('list', { name: exactlyPadded('Notificările dumneavoastră') }).getByRole('listitem'),
    ).toHaveCount(2);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
