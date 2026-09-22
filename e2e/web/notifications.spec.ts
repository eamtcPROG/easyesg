import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupNotifications,
  cleanupOrganizations,
  grantMembership,
  seedNotices,
  verificationTokenFor,
} from './support/db';

/**
 * S-26 and the global tier's count in a real browser (task 50.2.1; UC-165 … UC-167; FR-161, FR-162; §12.5.6's
 * task-50.2 rows (2) … (4)).
 *
 * **The notices are seeded**, because no category reaches a centre until 50.3 (`support/db.ts` says so beside
 * `seedNotices`). Everything the reader does to them goes through the shipped routes: the tabs are addresses, the
 * marks are Server Actions, opening one is the page's own link and its `keepalive` mark, and the band's count is the
 * browser's poll through the pass-through.
 *
 * **Every seeded notice is titled *Notificare*** — its category has no in-app wording — so the suite tells notices
 * apart by where each leads, not by what it says. That is the absence rule under test rather than a gap in the
 * fixtures: the item's own spec pins the words when there are some.
 */
const RUN_PREFIX = `e2e-web-notices-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupNotifications(organizations);
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** A verified member of a fresh organization, signed in on its home, with the notices given already in its centre. */
async function memberWith(
  page: Page,
  input: { readonly label: string; readonly notices: Parameters<typeof seedNotices>[0]['notices'] },
): Promise<{ readonly email: string; readonly organizationId: string }> {
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
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();

  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${input.label}` });
  organizations.push(organizationId);
  if (input.notices.length > 0) await seedNotices({ organizationId, email, notices: input.notices });

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return { email, organizationId };
}

const bell = (page: Page, name: string) => page.getByRole('banner').getByRole('link', { name, exact: true });
const centreList = (page: Page) => page.getByRole('list', { name: 'Notificările dumneavoastră' });
/** One notice, by where it leads — every seeded notice is titled alike. */
const notice = (page: Page, path: string) =>
  centreList(page)
    .getByRole('listitem')
    .filter({ has: page.locator(`a[href="${path}"]`) });

test.describe('S-26 — the notification centre', () => {
  test('a member with nothing yet is taught what the centre is for, and the band counts nothing', async ({ page }) => {
    await memberWith(page, { label: 'empty', notices: [] });

    // The count's first answer names the bell; with nothing unread it draws no number.
    await expect(bell(page, 'Notificări, nimic necitit')).toBeVisible();
    await bell(page, 'Notificări, nimic necitit').click();
    await page.waitForURL('**/notifications');

    const heading = page.getByRole('heading', { name: 'Notificări', level: 1 });
    await expect(heading).toBeVisible();
    // The screen's own title in the first heading's type role — a stylesheet class of the item's once overrode it,
    // with every assertion about the page's content still green.
    await expect(heading).toHaveCSS('font-size', '28px');
    await expect(page.getByText('Nicio notificare deocamdată')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mergeți la pagina principală' })).toBeVisible();
    // Nothing to filter or mark in an empty centre, so neither control is offered.
    await expect(page.getByRole('button', { name: 'Marcați toate ca citite' })).toHaveCount(0);
    await expect(bell(page, 'Notificări, nimic necitit')).toHaveAttribute('aria-current', 'page');
  });

  test("the band counts what is unread, the centre lists it, and the reader's own marks move both", async ({ page }) => {
    await memberWith(page, {
      label: 'marks',
      notices: [
        { deepLink: '/reports', minutesAgo: 5 },
        { deepLink: '/entities', minutesAgo: 30 },
        { deepLink: '/organization', minutesAgo: 90 },
        { deepLink: '/organization/users', minutesAgo: 600, read: true },
      ],
    });

    await expect(bell(page, 'Notificări, 3 necitite')).toBeVisible();
    await expect(bell(page, 'Notificări, 3 necitite')).toHaveText(/3/);
    await bell(page, 'Notificări, 3 necitite').click();
    await page.waitForURL('**/notifications');

    // The unread tab is the bare address, newest first.
    const unreadTab = page.getByRole('link', { name: 'Necitite · 3' });
    await expect(unreadTab).toHaveAttribute('aria-current', 'page');
    await expect(centreList(page).getByRole('listitem')).toHaveCount(3);
    await expect(centreList(page).getByRole('link', { name: 'Notificare' })).toHaveCount(3);
    await expect(centreList(page).getByRole('link', { name: 'Notificare' }).nth(0)).toHaveAttribute('href', '/reports');
    await expect(page.getByText('3 notificări necitite')).toBeAttached();

    await page.getByRole('link', { name: 'Toate' }).click();
    await page.waitForURL('**/notifications?show=all');
    await expect(centreList(page).getByRole('listitem')).toHaveCount(4);
    await expect(page.getByRole('link', { name: 'Toate' })).toHaveAttribute('aria-current', 'page');

    // One marked read: gone from the unread tab, and the band follows at once rather than on the next poll.
    await notice(page, '/entities').getByRole('button', { name: 'Marcați ca citită' }).click();
    await expect(notice(page, '/entities').getByRole('button', { name: 'Marcați ca citită' })).toHaveCount(0);
    await expect(bell(page, 'Notificări, 2 necitite')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Necitite · 2' })).toBeVisible();

    // One dismissed: out of the centre on every tab.
    await notice(page, '/organization/users').getByRole('button', { name: 'Ascundeți' }).click();
    await expect(centreList(page).getByRole('listitem')).toHaveCount(3);
    await expect(notice(page, '/organization/users')).toHaveCount(0);

    // Mark all: the unread tab becomes the filtered empty state, whose one action is the other tab.
    await page.getByRole('link', { name: 'Necitite · 2' }).click();
    await page.waitForURL(/\/notifications$/);
    await page.getByRole('button', { name: 'Marcați toate ca citite' }).click();
    await expect(page.getByText('Nimic necitit', { exact: true })).toBeVisible();
    await expect(bell(page, 'Notificări, nimic necitit')).toBeVisible();
    await page.getByRole('link', { name: 'Vedeți toate notificările' }).click();
    await page.waitForURL('**/notifications?show=all');
    await expect(centreList(page).getByRole('listitem')).toHaveCount(3);
    await expect(centreList(page).getByText('Necitită')).toHaveCount(0);
  });

  test('opening a notice takes the reader to what raised it, and records it read', async ({ page }) => {
    await memberWith(page, { label: 'open', notices: [{ deepLink: '/reports', minutesAgo: 1 }] });

    await page.goto('/notifications');
    await expect(bell(page, 'Notificări, 1 necitită')).toBeVisible();
    await centreList(page).getByRole('link', { name: 'Notificare' }).click();
    await page.waitForURL('**/reports');

    // The mark rode beside the navigation; the band hears it once it has landed.
    await expect(bell(page, 'Notificări, nimic necitit')).toBeVisible();
    await page.goto('/notifications?show=all');
    await expect(centreList(page).getByRole('listitem')).toHaveCount(1);
    await expect(centreList(page).getByText('Necitită')).toHaveCount(0);
  });

  test('the centre and the band speak each locale', async ({ page }) => {
    await memberWith(page, { label: 'locales', notices: [{ deepLink: '/home', minutesAgo: 1 }] });

    await page.goto('/en/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Unread · 1' })).toBeVisible();
    await expect(bell(page, 'Notifications, 1 unread')).toBeVisible();

    await page.goto('/ru/notifications');
    await expect(page.getByRole('heading', { name: 'Уведомления', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Непрочитанные · 1' })).toBeVisible();
    await expect(bell(page, 'Уведомления, 1 непрочитанное')).toBeVisible();
  });

  test('at the compact frame the drawer carries the centre, with its count', async ({ page }) => {
    await memberWith(page, { label: 'compact', notices: [{ deepLink: '/home', minutesAgo: 1 }] });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');
    // The compact bar draws no bell; the drawer's row is the way there.
    await expect(page.getByRole('banner').getByRole('link', { name: /^Notificări/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Meniu' }).click();
    const entry = page.getByRole('dialog').getByRole('link', { name: 'Notificări, 1 necitită' });
    await expect(entry).toBeVisible();
    await entry.click();
    await page.waitForURL('**/notifications');
    await expect(page.getByRole('heading', { name: 'Notificări', level: 1 })).toBeVisible();
  });
});
