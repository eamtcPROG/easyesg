import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * The organization switcher in a real browser (UC-16, FR-12, UX-2, UX-3, UX-37; task 83.2).
 *
 * **What only a browser proves here is where a switch lands and what it refuses to leave behind.** The
 * switcher's rows and states are `organization-switcher.spec.tsx`'s, the flow's branches the provider's spec,
 * the landing rule `switch-landing.spec.ts`'s. This drives what none of them can: the band re-rendered as the
 * chosen organization, the api refusing the new role's read and the reader landing home, the compact drawer
 * that closes on a choice, and a wizard whose answers cannot go.
 *
 * The first organization is administered and the second edited, so a screen only an administrator opens
 * separates *landed on the equivalent screen* from *landed home* — the owner's UX-3 decision, asserted.
 */
const RUN_PREFIX = `e2e-web-switch-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

/** B1's turnover, and the wizard's save-state region — the catalogue's own Romanian, as `autosave.spec.ts` reads them. */
const TURNOVER = 'Cifra de afaceri';
const SAVE_STATE_REGION = 'Starea salvării';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

interface Held {
  readonly id: string;
  readonly name: string;
}

/** An account administering one organization and editing another, signed in, with the first chosen on S-37. */
async function inTwoOrganizations(
  page: Page,
  label: string,
  /** Appended to both names — for the journey that needs a name longer than the drawer is wide. */
  suffix = '',
): Promise<{ readonly administering: Held; readonly editing: Held }> {
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
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();

  const administeringName = `${RUN_PREFIX} ${label} Alfa${suffix}`;
  const editingName = `${RUN_PREFIX} ${label} Beta${suffix}`;
  const administering = { name: administeringName, id: await grantMembership({ email, organizationName: administeringName }) };
  const editing = {
    name: editingName,
    id: await grantMembership({ email, organizationName: editingName, role: 'editor' }),
  };
  organizations.push(administering.id, editing.id);

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/choose-organization');
  await page
    .getByRole('main')
    .getByRole('button')
    .filter({ has: page.getByText(administering.name, { exact: true }) })
    .click();
  await page.waitForURL('**/home');
  return { administering, editing };
}

/** The band's switcher, named by what it is and which organization it names. */
const switcher = (page: Page) => page.getByRole('banner').getByRole('button', { name: /^Organizația activă: / });
const namedFor = (held: Held) => `Organizația activă: ${held.name}`;
const rowFor = (page: Page, held: Held) =>
  page.getByRole('menuitemradio').filter({ has: page.getByText(held.name, { exact: true }) });

test('the band names the organization as a control, offers each with its role, and lands where the new role can go', async ({
  page,
}) => {
  const { administering, editing } = await inTwoOrganizations(page, 'land');

  await page.goto('/organization/users');
  await expect(switcher(page)).toHaveAccessibleName(namedFor(administering));
  await switcher(page).click();

  // Each organization exactly once, the current one checked in state rather than only in weight (UX-102).
  await expect(page.getByRole('menuitemradio')).toHaveCount(2);
  await expect(rowFor(page, administering)).toHaveAttribute('aria-checked', 'true');
  await expect(rowFor(page, administering)).toContainText('Administrator al organizației');
  await expect(rowFor(page, editing)).toHaveAttribute('aria-checked', 'false');
  await expect(rowFor(page, editing)).toContainText('Editare');
  await expect(page.getByRole('menuitem', { name: 'Creați o altă organizație' })).toBeVisible();

  // Users & access is an administrator's screen, and the role chosen is an editor's: the api refuses that
  // screen's read, so the reader lands home rather than on a refusal (UX-3's amendment).
  await rowFor(page, editing).click();

  await page.waitForURL('**/home');
  await expect(switcher(page)).toHaveAccessibleName(namedFor(editing));
  // A switch that has landed is over: the control is not left marked busy, with its rows held.
  await expect(switcher(page)).not.toHaveAttribute('aria-busy', 'true');
});

test('a section, a record and the account’s own screen each land on their equivalent (UX-3)', async ({ page }) => {
  const { administering, editing } = await inTwoOrganizations(page, 'equivalent');

  // A section every role opens is its own equivalent.
  await page.goto('/entities');
  await switcher(page).click();
  await rowFor(page, editing).click();
  await expect(switcher(page)).toHaveAccessibleName(namedFor(editing));
  // Not busy first: the band is renamed before the landing commits, so the address is read once the switch
  // is over — read earlier, the address the page already had would pass for the landing.
  await expect(switcher(page)).not.toHaveAttribute('aria-busy', 'true');
  await expect(page).toHaveURL(/\/entities$/);

  // A creation form belongs to the organization left, so its section is the equivalent.
  await page.goto('/reports/new');
  await switcher(page).click();
  await rowFor(page, administering).click();
  await expect(switcher(page)).toHaveAccessibleName(namedFor(administering));
  await expect(switcher(page)).not.toHaveAttribute('aria-busy', 'true');
  await expect(page).toHaveURL(/\/reports$/);

  // The account's own screen is the same in every organization.
  await page.goto('/account/credentials');
  await switcher(page).click();
  await rowFor(page, editing).click();
  await expect(switcher(page)).toHaveAccessibleName(namedFor(editing));
  await expect(switcher(page)).not.toHaveAttribute('aria-busy', 'true');
  await expect(page).toHaveURL(/\/account\/credentials$/);
});

test('at compact width the organization is the drawer’s, and a switch made there closes it (UX-2’s amendment)', async ({
  page,
}) => {
  const { administering, editing } = await inTwoOrganizations(page, 'compact', ' Societate cu Răspundere Limitată');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');

  // The compact bar names no organization — not hidden from sight alone, but out of the accessibility tree,
  // so a screen reader is not offered the drawer's control twice.
  await expect(switcher(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Meniu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Meniu' });
  const inDrawer = drawer.getByRole('button', { name: /^Organizația activă: / });
  await expect(inDrawer).toHaveAccessibleName(namedFor(administering));
  // **In full** (UX-2's amendment): the drawer wraps a name longer than itself where the band cuts one, which an
  // accessible name cannot show — so the name's own box is measured rather than its text.
  const nameInDrawer = inDrawer.locator('span').first();
  await expect.poll(() => nameInDrawer.evaluate((name) => name.scrollWidth <= name.clientWidth)).toBe(true);

  await inDrawer.click();
  // Opening the menu leaves the drawer standing: the trigger is not a destination.
  await expect(drawer).toBeVisible();
  await rowFor(page, editing).click();

  await expect(page.getByRole('dialog', { name: 'Meniu' })).toHaveCount(0);
  // The landing screen names the chosen organization before the drawer is reopened onto it, so what the
  // reopened drawer shows is the switch's outcome rather than a race with it.
  await expect(page.getByRole('main').locator('hgroup p')).toContainText(editing.name);
  await page.getByRole('button', { name: 'Meniu' }).click();
  const reopened = page.getByRole('dialog', { name: 'Meniu' }).getByRole('button', { name: /^Organizația activă: / });
  await expect(reopened).toHaveAccessibleName(namedFor(editing));
  // **The assertion that found the defect**: the switch landed and the control was still marked busy.
  await expect(reopened).not.toHaveAttribute('aria-busy', 'true');
});

/**
 * UX-37's third trigger, and UX-3's *flushed first*. A wizard answer made offline cannot go, so the switch
 * asks before leaving it and does nothing when the reader stays; once the connection is back the answer goes
 * on its own, and the same switch then happens without a question.
 */
test('a switch that would leave unsent answers asks first, and goes once they have been sent (UX-3, UX-37)', async ({
  page,
  context,
}) => {
  const { administering, editing } = await inTwoOrganizations(page, 'unsent');
  const reportId = await seedReport({ organizationId: administering.id, name: `${RUN_PREFIX}-unsent-entity` });
  const step = `/reports/${reportId}/B1`;
  await page.goto(step);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B1');
  const saveState = page.getByRole('status', { name: SAVE_STATE_REGION });
  await expect(saveState).toHaveText(/Salvat/u);

  await context.setOffline(true);
  const turnover = page.getByRole('textbox', { name: TURNOVER, exact: true });
  await turnover.fill('1000');
  await turnover.press('Tab');
  await expect(saveState).toHaveText(/În așteptare — fără conexiune/u);

  await switcher(page).click();
  // The note counts what is unsent — B1's arrival default is pending offline too, so the count is not pinned.
  await expect(page.getByRole('menu')).toContainText(/nu (a|au) fost încă trimis/u);
  await rowFor(page, editing).click();

  const question = page.getByRole('alertdialog', { name: 'Schimbați organizația cu răspunsuri netrimise?' });
  await expect(question).toBeVisible();
  await question.getByRole('button', { name: 'Rămâneți aici' }).click();

  await expect(question).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${step}$`));
  await expect(switcher(page)).toHaveAccessibleName(namedFor(administering));

  await context.setOffline(false);
  await expect(saveState).toHaveText(/Salvat/u);

  await switcher(page).click();
  await expect(page.getByRole('menu')).not.toContainText(/nu (a|au) fost încă trimis/u);
  await rowFor(page, editing).click();

  // From a report's step, the equivalent is the reports screen, which an editor opens.
  await page.waitForURL('**/reports');
  await expect(switcher(page)).toHaveAccessibleName(namedFor(editing));
  await expect(switcher(page)).not.toHaveAttribute('aria-busy', 'true');
});
