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
 * S-26, the global tier's count and the panel it opens, in a real browser (tasks 50.2.1, 50.2.2; UC-165 … UC-167;
 * FR-161, FR-162; §12.5.6's task-50.2 rows (1) … (5)).
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

const bell = (page: Page, name: string) => page.getByRole('banner').getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Notificări' });
const centreList = (page: Page) => page.getByRole('list', { name: 'Notificările dumneavoastră' });
/** One notice, by where it leads — every seeded notice is titled alike. */
const notice = (page: Page, path: string) =>
  centreList(page)
    .getByRole('listitem')
    .filter({ has: page.locator(`a[href="${path}"]`) });

test.describe('S-26 — the notification centre', () => {
  test('a member with nothing yet is taught what the centre is for, and the band counts nothing', async ({ page }) => {
    await memberWith(page, { label: 'empty', notices: [] });

    // The count's first answer names the bell; with nothing unread it draws no number. The panel it opens teaches
    // too, and its foot is the way to the centre.
    await expect(bell(page, 'Notificări, nimic necitit')).toBeVisible();
    await bell(page, 'Notificări, nimic necitit').click();
    await expect(panel(page).getByText('Nicio notificare deocamdată')).toBeVisible();
    await panel(page).getByRole('link', { name: 'Toate notificările' }).click();
    await page.waitForURL('**/notifications');
    await expect(panel(page)).toHaveCount(0);

    const heading = page.getByRole('heading', { name: 'Notificări', level: 1 });
    await expect(heading).toBeVisible();
    // The screen's own title in the first heading's type role — a stylesheet class of the item's once overrode it,
    // with every assertion about the page's content still green.
    await expect(heading).toHaveCSS('font-size', '28px');
    await expect(page.getByText('Nicio notificare deocamdată')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mergeți la pagina principală' })).toBeVisible();
    // Nothing to mark, so *mark all* is not offered; the two views stay, as S-06's filters stay over an empty list.
    await expect(page.getByRole('button', { name: 'Marcați toate ca citite' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Necitite · 0' })).toBeVisible();
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
    await page.goto('/notifications');

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

    // Each control is described by its notice, so a list of identical buttons still says which each one acts on.
    await expect(notice(page, '/entities').getByRole('button', { name: 'Marcați ca citită' })).toHaveAccessibleDescription(
      'Notificare',
    );
    await expect(notice(page, '/entities').getByRole('button', { name: 'Ascundeți' })).toHaveAccessibleDescription(
      'Notificare',
    );

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

  test('the centre lists the oldest first on request, and keeps that order across its views', async ({ page }) => {
    await memberWith(page, {
      label: 'order',
      notices: [
        { deepLink: '/reports', minutesAgo: 5 },
        { deepLink: '/entities', minutesAgo: 60 },
        { deepLink: '/organization', minutesAgo: 600, read: true },
      ],
    });
    /** Where each listed notice leads, in the order listed — every seeded notice is titled alike. */
    const listed = () =>
      centreList(page)
        .getByRole('link', { name: 'Notificare' })
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

    await page.goto('/notifications?show=all');
    await expect(page.getByRole('link', { name: 'Cele mai noi întâi' })).toHaveAttribute('aria-current', 'page');
    await expect.poll(listed).toEqual(['/reports', '/entities', '/organization']);

    await page.getByRole('link', { name: 'Cele mai vechi întâi' }).click();
    await page.waitForURL('**/notifications?show=all&order=oldest');
    await expect(page.getByRole('link', { name: 'Cele mai vechi întâi' })).toHaveAttribute('aria-current', 'page');
    await expect.poll(listed).toEqual(['/organization', '/entities', '/reports']);

    // Another view keeps the order chosen.
    await page.getByRole('link', { name: 'Necitite · 2' }).click();
    await page.waitForURL('**/notifications?order=oldest');
    await expect.poll(listed).toEqual(['/entities', '/reports']);
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

  test('the centre, the band and the panel speak each locale', async ({ page }) => {
    await memberWith(page, { label: 'locales', notices: [{ deepLink: '/home', minutesAgo: 1 }] });

    await page.goto('/en/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Unread · 1' })).toBeVisible();
    await bell(page, 'Notifications, 1 unread').click();
    const english = page.getByRole('dialog', { name: 'Notifications' });
    await expect(english.getByRole('list', { name: 'Latest notifications' }).getByRole('listitem')).toHaveCount(1);
    await expect(english.getByRole('link', { name: 'All notifications' })).toBeVisible();
    await english.getByRole('button', { name: 'Close' }).click();
    await expect(english).toHaveCount(0);

    await page.goto('/ru/notifications');
    await expect(page.getByRole('heading', { name: 'Уведомления', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Непрочитанные · 1' })).toBeVisible();
    await bell(page, 'Уведомления, 1 непрочитанное').click();
    const russian = page.getByRole('dialog', { name: 'Уведомления' });
    await expect(russian.getByRole('list', { name: 'Последние уведомления' }).getByRole('listitem')).toHaveCount(1);
    await expect(russian.getByRole('link', { name: 'Все уведомления' })).toBeVisible();
    await russian.getByRole('button', { name: 'Закрыть' }).click();
    await expect(russian).toHaveCount(0);
  });

  test('at the compact frame the bar keeps its bell, and the drawer carries the centre, with its count', async ({
    page,
  }) => {
    await memberWith(page, { label: 'compact', notices: [{ deepLink: '/home', minutesAgo: 1 }] });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/home');
    // The compact bar draws the bell beside the drawer's trigger, and it opens the panel as it does wider.
    await bell(page, 'Notificări, 1 necitită').click();
    await expect(panel(page).getByRole('list', { name: 'Ultimele notificări' }).getByRole('listitem')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Meniu' }).click();
    const entry = page.getByRole('dialog').getByRole('link', { name: 'Notificări, 1 necitită' });
    await expect(entry).toBeVisible();
    await entry.click();
    await page.waitForURL('**/notifications');
    await expect(page.getByRole('heading', { name: 'Notificări', level: 1 })).toBeVisible();
  });

  test("a reminder reads in its own words — its category, the sender and the report, the note, and a way to it", async ({
    page,
  }) => {
    await memberWith(page, {
      label: 'worded',
      notices: [
        {
          deepLink: '/reports',
          minutesAgo: 2,
          categoryKey: 'reporting.manual_reminder',
          // The parameters `SendReportReminder` raises (task 50.3).
          params: {
            senderName: 'Ana Popescu',
            entityName: 'Brutăria Lina',
            fiscalYear: '2026',
            noteGiven: 'given',
            note: 'Lipsesc datele despre energie.',
          },
        },
      ],
    });
    const title = 'Ana Popescu vă reamintește de raportul Brutăria Lina pentru 2026';

    await page.goto('/notifications');
    const item = centreList(page).getByRole('listitem');
    await expect(item).toHaveCount(1);
    await expect(item.getByText('Mementouri', { exact: true })).toBeVisible();
    await expect(item.getByText(title)).toBeVisible();
    await expect(item.getByText('„Lipsesc datele despre energie.”')).toBeVisible();
    // With action words the link is the action, described by the title it acts on.
    const action = item.getByRole('link', { name: 'Deschideți raportul' });
    await expect(action).toHaveAttribute('href', '/reports');
    await expect(action).toHaveAccessibleDescription(title);

    // The panel draws the same item, through the same component.
    await bell(page, 'Notificări, 1 necitită').click();
    const inPanel = panel(page).getByRole('list', { name: 'Ultimele notificări' }).getByRole('listitem');
    await expect(inPanel.getByText(title)).toBeVisible();
    await expect(inPanel.getByRole('link', { name: 'Deschideți raportul' })).toBeVisible();
  });

  test('the bell opens the panel: the latest notices, its two views, opening one, and mark all', async ({ page }) => {
    await memberWith(page, {
      label: 'panel',
      notices: [
        { deepLink: '/reports', minutesAgo: 2 },
        { deepLink: '/entities', minutesAgo: 40 },
        { deepLink: '/organization', minutesAgo: 300, read: true },
      ],
    });
    const latest = panel(page).getByRole('list', { name: 'Ultimele notificări' });

    await bell(page, 'Notificări, 2 necitite').click();
    await expect(bell(page, 'Notificări, 2 necitite')).toHaveAttribute('aria-expanded', 'true');
    await expect(latest.getByRole('listitem')).toHaveCount(2);
    await expect(panel(page).getByRole('button', { name: 'Necitite · 2' })).toHaveAttribute('aria-pressed', 'true');
    await panel(page).getByRole('button', { name: 'Toate', exact: true }).click();
    await expect(latest.getByRole('listitem')).toHaveCount(3);

    // Opening one leaves for what raised it, closes the panel, and marks it — the bell follows once it lands.
    await latest.locator('a[href="/reports"]').click();
    await page.waitForURL('**/reports');
    await expect(panel(page)).toHaveCount(0);
    await expect(bell(page, 'Notificări, 1 necitită')).toBeVisible();

    // Mark all from the panel: its unread view becomes the filtered state, whose action is the other view.
    await bell(page, 'Notificări, 1 necitită').click();
    await panel(page).getByRole('button', { name: 'Marcați toate ca citite' }).click();
    await expect(panel(page).getByText('Nimic necitit', { exact: true })).toBeVisible();
    await expect(bell(page, 'Notificări, nimic necitit')).toBeVisible();
    await panel(page).getByRole('button', { name: 'Vedeți toate' }).click();
    await expect(latest.getByRole('listitem')).toHaveCount(3);
    await expect(latest.getByText('Necitită')).toHaveCount(0);

    // Escape closes it and gives focus back to the bell.
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(bell(page, 'Notificări, nimic necitit')).toBeFocused();
  });

  test("a switch of organization counts and lists the new organization's centre, never the one left", async ({
    page,
  }) => {
    // Two organizations with different centres: one unread notice in the first, two in the second.
    const email = `${RUN_PREFIX}-switch@example.md`;
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
    const first = `${RUN_PREFIX} switch Alfa`;
    const second = `${RUN_PREFIX} switch Beta`;
    const firstId = await grantMembership({ email, organizationName: first });
    const secondId = await grantMembership({ email, organizationName: second });
    organizations.push(firstId, secondId);
    await seedNotices({ organizationId: firstId, email, notices: [{ deepLink: '/entities', minutesAgo: 5 }] });
    await seedNotices({
      organizationId: secondId,
      email,
      notices: [
        { deepLink: '/reports', minutesAgo: 3 },
        { deepLink: '/organization', minutesAgo: 4 },
      ],
    });

    await page.goto('/sign-in');
    await page.getByLabel('Adresa de e-mail').fill(email);
    await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Intrați în cont' }).click();
    await page.waitForURL('**/choose-organization');
    await page.getByRole('main').getByRole('button').filter({ has: page.getByText(first, { exact: true }) }).click();
    await page.waitForURL('**/home');

    // The first organization's centre, read into the page's cache: its count, and its panel opened once.
    await bell(page, 'Notificări, 1 necitită').click();
    const latest = panel(page).getByRole('list', { name: 'Ultimele notificări' });
    await expect(latest.getByRole('listitem')).toHaveCount(1);
    await page.keyboard.press('Escape');

    // The switch is a client-side landing, so the page's query cache outlives it. The count must be the second
    // organization's at once — not the first's until the next minute's poll.
    await page.getByRole('banner').getByRole('button', { name: /^Organizația activă: / }).click();
    await page.getByRole('menuitemradio').filter({ has: page.getByText(second, { exact: true }) }).click();
    await expect(page.getByRole('banner').getByRole('button', { name: `Organizația activă: ${second}` })).toBeVisible();
    await expect(bell(page, 'Notificări, 2 necitite')).toBeVisible();

    // And the panel opens on the new organization's list, never the first's drawn while it is read. The read is held,
    // so what the panel shows before it answers is what it had to show: its loading state.
    let answer: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    await page.route(/\/api\/v1\/notifications\?/, async (route) => {
      await held;
      await route.continue();
    });
    await bell(page, 'Notificări, 2 necitite').click();
    await expect(panel(page).getByRole('status')).toBeVisible();
    await expect(panel(page).locator('a[href="/entities"]')).toHaveCount(0);
    answer();
    await expect(latest.getByRole('listitem')).toHaveCount(2);
    await expect(latest.locator('a[href="/entities"]')).toHaveCount(0);
  });
});
