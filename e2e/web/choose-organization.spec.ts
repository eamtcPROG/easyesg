import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  removeMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-37 in a real browser (FR-12, UC-16; task 83.3; `design_spec.md` S-37).
 *
 * **What only a browser proves here is where the reader ends up, from each way in.** `post-sign-in.spec.ts`
 * and `choice-exit.spec.ts` in `apps/web` state the two rules arm by arm, and the list's refusals are a
 * component spec. This drives what they cannot see: the branch reading real memberships, the gate in two
 * layouts and in a screen's permission arm learning the requested address from the proxy's header, and the
 * choice reaching the api and the band above the screen it lands on.
 *
 * Memberships are seeded, as `post-sign-in.spec.ts` seeds them: what is under test is choosing among
 * organizations, not the ways one is joined.
 */
const RUN_PREFIX = `e2e-web-choice-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function registerAndVerify(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

async function signIn(page: Page, email: string, returnTo?: string): Promise<void> {
  await page.goto(returnTo ? `/sign-in?return=${encodeURIComponent(returnTo)}` : '/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
}

/** An account in organizations named after `label`, one per role given, signed in with nothing chosen. */
async function awaitingAChoice(
  page: Page,
  label: string,
  roles: readonly ('editor' | 'organization_administrator')[],
  returnTo?: string,
): Promise<{ email: string; organizations: { id: string; name: string }[] }> {
  const email = addressFor(label);
  await registerAndVerify(page, email);
  const held: { id: string; name: string }[] = [];
  for (const [index, role] of roles.entries()) {
    const name = `${RUN_PREFIX} ${label} ${index + 1}`;
    const id = await grantMembership({ email, organizationName: name, role });
    organizations.push(id);
    held.push({ id, name });
  }
  await signIn(page, email, returnTo);
  return { email, organizations: held };
}

/** S-37 at its bare address, or carrying exactly this `?return=`. */
const atChoice = (returnTo: string | null) => (url: URL) =>
  url.pathname.endsWith('/choose-organization') && url.searchParams.get('return') === returnTo;

const choices = (page: Page) => page.getByRole('main').getByRole('button');
const choiceFor = (page: Page, name: string) => choices(page).filter({ hasText: name });

test('several organizations and none chosen: sign-in asks, and the choice opens the one chosen', async ({
  page,
}) => {
  const {
    organizations: [editing, administering],
  } = await awaitingAChoice(page, 'several', ['editor', 'organization_administrator']);

  await page.waitForURL(atChoice(null));
  await expect(page.getByRole('heading', { name: 'Alegeți organizația', level: 1 })).toBeVisible();
  // Each organization exactly once, with the role held there — the count is the assertion.
  await expect(choices(page)).toHaveCount(2);
  await expect(choiceFor(page, editing.name)).toContainText('Editare');
  await expect(choiceFor(page, administering.name)).toContainText('Administrator al organizației');
  // Nothing is in scope, so the band names no organization (UX-2's empty state) — asserted as no switcher at
  // all rather than one name absent, since a band that fell back to a membership would name the other.
  await expect(page.getByRole('banner').getByRole('button', { name: /^Organizația activă: / })).toHaveCount(0);

  await choiceFor(page, administering.name).click();

  await page.waitForURL('**/home');
  await expect(page.getByRole('banner').getByText(administering.name)).toBeVisible();
});

test('a deep link rides through the choice (S-37’s exits)', async ({ page }) => {
  const {
    organizations: [first],
  } = await awaitingAChoice(page, 'deep-link', ['editor', 'editor'], '/reports');

  await page.waitForURL(atChoice('/reports'));
  await choiceFor(page, first.name).click();

  await page.waitForURL('**/reports');
  await expect(page.getByRole('banner').getByText(first.name)).toBeVisible();
});

/**
 * The gate, in both layouts, and the one exception it makes. Nothing is chosen, so every address below is
 * requested by a reader for whom no organization resolves.
 */
test('the workspace and the wizard send a reader who has not chosen to choose; the account screen does not', async ({
  page,
}) => {
  await awaitingAChoice(page, 'gate', ['editor', 'editor']);
  await page.waitForURL(atChoice(null));

  // **Answered before the screen's first byte**: the layout's gate, outside every boundary, makes a request in
  // this state a `307`, where a gate inside one would answer `200` and redirect once the shell had streamed.
  const answered = await page.request.get('/entities', { maxRedirects: 0 });
  expect(answered.status()).toBe(307);
  expect(answered.headers().location).toMatch(/\/choose-organization\?return=%2Fentities$/);

  await page.goto('/entities');
  await page.waitForURL(atChoice('/entities'));

  // A report's step, under the wizard's own layout. No report exists behind the id: the gate turns the
  // reader away before anything the step reads could matter.
  const step = '/reports/01920000-0000-7000-8000-00000000cafe/b1';
  await page.goto(step);
  await page.waitForURL(atChoice(step));

  // S-28 reads nothing of an organization's, so it renders in this state (UX-3's amendment).
  await page.goto('/account/credentials');
  await expect(page.getByRole('heading', { name: 'Date de autentificare', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/account\/credentials$/);
});

test('a choice left stale by a removal is asked for again where it is met, without the organization that removed the reader', async ({
  page,
}) => {
  const {
    email,
    organizations: [removing, staying, other],
  } = await awaitingAChoice(page, 'stale', ['editor', 'editor', 'editor']);
  await page.waitForURL(atChoice(null));
  await choiceFor(page, removing.name).click();
  await page.waitForURL('**/home');

  await removeMembership({ email, organizationId: removing.id });
  await page.goto('/entities');

  await page.waitForURL(atChoice('/entities'));
  await expect(choices(page)).toHaveCount(2);
  await expect(choiceFor(page, removing.name)).toHaveCount(0);
  await expect(choiceFor(page, other.name)).toHaveCount(1);

  await choiceFor(page, staying.name).click();
  await page.waitForURL('**/entities');
  await expect(page.getByRole('banner').getByText(staying.name)).toBeVisible();
});

/**
 * **The same state met by following a link, not by loading a page** (task 83's parent close). A layout is not
 * rendered again when a link inside its group is followed, so the workspace layout's gate never sees a removal
 * that lands mid-session; the next screen's own read is refused instead, and its permission arm asks the gate's
 * question. The journey above loads `/entities`, which the layout answers — this one follows the tier's link,
 * in the same document throughout.
 */
test('a choice left stale by a removal is asked for again when a link is followed', async ({ page }) => {
  const {
    email,
    organizations: [removing, staying, other],
  } = await awaitingAChoice(page, 'stale-link', ['editor', 'editor', 'editor']);
  await page.waitForURL(atChoice(null));
  await choiceFor(page, removing.name).click();
  await page.waitForURL('**/home');

  // Hydrated before the link is followed — the switcher opens only once it is — or the click would be a page
  // load, which the layout's gate answers, and this journey would prove nothing the one above does not.
  const band = page.getByRole('banner').getByRole('button', { name: /^Organizația activă: / });
  await band.click();
  await expect(page.getByRole('menuitemradio')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).easyesgSameDocument = true;
  });

  await removeMembership({ email, organizationId: removing.id });
  await page.getByRole('navigation', { name: 'Secțiunile organizației' }).getByRole('link', { name: 'Entități' }).click();

  await page.waitForURL(atChoice('/entities'));
  // Still the document the link was followed in: no page load answered this.
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).easyesgSameDocument)).toBe(true);
  await expect(choices(page)).toHaveCount(2);
  await expect(choiceFor(page, removing.name)).toHaveCount(0);
  await expect(choiceFor(page, other.name)).toHaveCount(1);

  await choiceFor(page, staying.name).click();
  await page.waitForURL('**/entities');
  await expect(page.getByRole('banner').getByText(staying.name)).toBeVisible();
});

test('a reader with an organization resolved is sent past the screen', async ({ page }) => {
  const email = addressFor('resolved');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} resolved` }));
  await signIn(page, email);
  await page.waitForURL('**/home');

  await page.goto('/choose-organization');

  await page.waitForURL('**/home');
});
