import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupNotifications,
  cleanupOrganizations,
  grantMembership,
  seedNotices,
  verificationTokenFor,
} from './support/db';
import { exactlyPadded, overflowWithin } from './support/expansion';

/**
 * S-26 and the band's count at +40% (UX-94, UX-73's three frames; task 50.2.1).
 *
 * **The heading row is what widens first**: the title with its count, the lede, and at the row's end two tabs, the
 * two orders and *Mark all as read*, five controls whose words grow with the rest. So the suite seeds an unread notice
 * and a read one — the tabs and *mark all* both render, and each item draws its time, its link and its two controls
 * padded.
 *
 * **The unread notice is a worded one** (task 50.3): the manual reminder, with its category's name, a title, a
 * quoted note and action words, so the item is measured with every part drawn as well as the untitled read one with
 * none. **Its words are not padded**: the api resolves them, and the one api both web instances share serves its
 * catalogue unpadded, so they stand at their Romanian length while the app's own words around them grow — which is
 * why the note is long, a sender's own text being as long as they make it in any language.
 *
 * **The panel too, at all three** (task 50.2.2): 380px at most and never wider than the frame, its header holding the
 * title, the count, *mark all* and the close, all padded.
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
      // The worded item at its widest (task 50.3): a category's name, a title, a quoted note and action words.
      {
        deepLink: '/reports',
        minutesAgo: 3,
        categoryKey: 'reporting.manual_reminder',
        params: {
          senderName: 'Ana Popescu',
          entityName: 'Brutăria Lina',
          fiscalYear: '2026',
          noteGiven: 'given',
          note: 'Lipsesc datele despre consumul de energie pentru anul trecut, pe fiecare locație în parte.',
        },
      },
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
    await expect(page.getByRole('link', { name: exactlyPadded('Cele mai vechi întâi') })).toBeVisible();
    const list = page.getByRole('list', { name: exactlyPadded('Notificările dumneavoastră') });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    // The worded item really is worded — its category, its title and its action words, from the api. Seeded under a
    // category with no wording, every assertion below still passes while the item draws at its narrowest.
    //
    // **`exactlyPadded` here too, since task 51.3.** These three were the only assertions in the whole expansion
    // suite naming words the api resolves, and they were written unpadded because the api served real words to a
    // padded screen — the measurement UX-94 asks for, quietly not taken. They now say what every other assertion on
    // this page says: the text arrived, and it arrived at +40%.
    await expect(list.getByText(exactlyPadded('Mementouri'))).toBeVisible();
    await expect(
      list.getByText(exactlyPadded('Ana Popescu vă reamintește de raportul Brutăria Lina pentru 2026')),
    ).toBeVisible();
    await expect(list.getByRole('link', { name: exactlyPadded('Deschideți raportul') })).toBeVisible();
    // The list clips its rows, so a row's controls pushed past its edge would never widen the page.
    expect(await overflowWithin(list)).toBeLessThanOrEqual(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

for (const frame of FRAMES) {
  test(`the panel tolerates +40% at ${frame.width}`, async ({ page }) => {
    await signedIn(page, `p${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto('/home');

    await page.getByRole('banner').getByRole('button', { name: /^Notificări/ }).click();
    const panel = page.getByRole('dialog', { name: exactlyPadded('Notificări') });
    await expect(panel.getByRole('button', { name: exactlyPadded('Marcați toate ca citite') })).toBeVisible();
    await expect(panel.getByRole('list', { name: exactlyPadded('Ultimele notificări') }).getByRole('listitem')).toHaveCount(1);

    // Nothing in the panel reaches past its edge — it is fixed and clips, so the page would never say so — the panel
    // stays inside the frame, and the page beneath it gains no horizontal scroll.
    expect(await overflowWithin(panel)).toBeLessThanOrEqual(1);
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(frame.width);
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
