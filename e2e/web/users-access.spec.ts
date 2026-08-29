import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-16 in a real browser (UC-59 … UC-64; task 26.4).
 *
 * **Every write here goes through the shipped routes**, which is new: task 26.3's suite had to seed
 * invitations directly, and `support/db.ts` says why in as many words — "because S-16 does not exist
 * yet (task 26.4)". It does now, so the invitation this suite creates is created by pressing the
 * button, and the list that shows it is the union read model assembling two API collections.
 *
 * What is seeded is only what no route can create: the organization and its first administrator
 * (task 29 founds an organization; until then a membership has no UI).
 *
 * The filter, sort and page arithmetic are a unit spec — `features/organization/access.spec.ts`,
 * arm by arm, because the module is pure. What this proves is the wiring those arms cannot: that
 * the address carries the view, that the actions reach the API, and that the refusals a person can
 * actually provoke reach the screen as sentences rather than as an error page.
 */
const RUN_PREFIX = `e2e-web-access-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function registerAndVerify(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

/**
 * Sign in and **wait for the branch to land**.
 *
 * Not optional: sign-in redirects through §4.3's post-sign-in branch, and a `goto` issued before
 * that settles races the session cookie — the request arrives without one and the closed-by-default
 * gate correctly bounces it to sign-in. With exactly one membership the branch lands on `/home`,
 * so that is the signal there is a session to navigate with.
 */
async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

/** An organization with the signed-in account as its administrator, which is S-16's actor. */
async function administratorOf(page: Page, label: string): Promise<string> {
  const email = addressFor(label);
  await registerAndVerify(page, email);
  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-${label}`,
  });
  organizations.push(organizationId);
  await signIn(page, email);
  return email;
}

const openAccessScreen = async (page: Page) => {
  await page.goto('/organization/users');
  await expect(page.getByRole('heading', { name: 'Utilizatori și acces', level: 1 })).toBeVisible();
};

/**
 * The person's own cell.
 *
 * `exact` is load-bearing: the role cell in the same row carries a visually-hidden label — "Rolul
 * lui <address>", because a select in a table row needs a name of its own — so a substring match
 * finds both cells and Playwright's strict mode refuses. Which is the accessible name doing exactly
 * its job, seen from the other side.
 */
const personCell = (page: Page, email: string) =>
  page.getByRole('cell', { name: email, exact: true });

/** Radix Select: open the trigger by its label, then choose the option by name. */
async function choose(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option }).click();
}

test('the administrator sees themself, and invites a colleague who appears as invited', async ({
  page,
}) => {
  const administrator = await administratorOf(page, 'invite');
  await openAccessScreen(page);

  // The union's first half: the seeded membership, rendered from `GET /members`.
  await expect(personCell(page, administrator)).toBeVisible();
  // `exact`: the member's status chip, not the word inside a longer sentence elsewhere on the
  // screen. It used to disambiguate against the interim session strip's "Contul activ:", which
  // task 30.1 deleted — the reason changed, the need did not.
  await expect(page.getByText('Activ', { exact: true })).toBeVisible();

  const invited = addressFor('invite-guest');
  await page.getByLabel('Adresa de e-mail').fill(invited);
  await choose(page, 'Rolul acordat', 'Doar vizualizare');
  await page.getByRole('button', { name: 'Trimiteți invitația', exact: true }).click();

  // The other half, through the same list — which is the whole point of the read model.
  await expect(personCell(page, invited)).toBeVisible();
  await expect(page.getByText('Invitat', { exact: true })).toBeVisible();
});

test('a second invitation to the same address is refused, in words the reader can act on', async ({
  page,
}) => {
  await administratorOf(page, 'collide');
  await openAccessScreen(page);

  const invited = addressFor('collide-guest');
  const invite = async () => {
    await page.getByLabel('Adresa de e-mail').fill(invited);
    await choose(page, 'Rolul acordat', 'Editare');
    await page.getByRole('button', { name: 'Trimiteți invitația', exact: true }).click();
    await expect(personCell(page, invited)).toBeVisible();
  };

  await invite();
  await invite();

  // The API's own sentence, rendered as received — the screen keeps no second copy of it.
  //
  // **Unscoped, and `.first()` is gone** (28 Aug 2026). The screen holds one notice, so a second
  // alert means two settled outcomes are on screen at once — which is what this locator had been
  // tolerating while the invite panel kept an outcome outside the reducer. `FormSummary` is the
  // only other `role="alert"` here and renders only on a validation error, of which this journey
  // has none.
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(personCell(page, invited)).toHaveCount(1);
});

test('an invitation can be withdrawn, and the confirmation names the person', async ({ page }) => {
  await administratorOf(page, 'revoke');
  await openAccessScreen(page);

  const invited = addressFor('revoke-guest');
  await page.getByLabel('Adresa de e-mail').fill(invited);
  await choose(page, 'Rolul acordat', 'Editare');
  await page.getByRole('button', { name: 'Trimiteți invitația', exact: true }).click();
  await expect(personCell(page, invited)).toBeVisible();

  await page.getByRole('button', { name: 'Anulați invitația' }).click();

  // UX-70: the specific object, by name, and the specific consequence.
  const dialogue = page.getByRole('alertdialog');
  await expect(dialogue).toContainText(invited);
  await expect(dialogue).toContainText('nu mai funcționează');
  await dialogue.getByRole('button', { name: 'Anulați invitația' }).click();

  await expect(personCell(page, invited)).toHaveCount(0);
});

test('the sole administrator cannot be demoted or removed, and the screen says why', async ({
  page,
}) => {
  await administratorOf(page, 'lockout');
  await openAccessScreen(page);

  // FR-60 on the screen's side: the action is not offered, and the reason is stated rather than
  // left to a disabled control the reader has to guess at.
  await expect(page.getByRole('button', { name: 'Retrageți accesul' })).toBeDisabled();
  await expect(page.getByText('Este singurul administrator al organizației.')).toBeVisible();
});

test('the view lives in the address, so a filtered list can be linked and reloaded', async ({
  page,
}) => {
  await administratorOf(page, 'url');
  await openAccessScreen(page);

  // The default view writes nothing — a bare path and the default are one address (UX-4).
  expect(new URL(page.url()).search).toBe('');

  await choose(page, 'Rolul', 'Doar vizualizare');
  await page.waitForURL('**/organization/users?role=viewer');

  // Reloading the address reproduces the view rather than resetting it.
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Rolul', exact: true })).toContainText(
    'Doar vizualizare',
  );
  await expect(page.getByText('Nicio persoană nu corespunde filtrelor')).toBeVisible();
});

test('someone who does not administer the organization is told so, not shown an error', async ({
  page,
}) => {
  const editor = addressFor('editor');
  await registerAndVerify(page, editor);
  const organizationId = await grantMembership({
    email: editor,
    organizationName: `${RUN_PREFIX}-editor-org`,
    role: 'editor',
  });
  organizations.push(organizationId);
  await signIn(page, editor);
  await page.goto('/organization/users');

  // S-16's permission state (§8.1), from the API's own refusal — the screen never computed a role.
  await expect(
    page.getByText('Această pagină este pentru administratorii organizației'),
  ).toBeVisible();
});
