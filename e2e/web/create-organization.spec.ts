import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  organizationIdsForAccount,
  verificationTokenFor,
} from './support/db';

/**
 * S-04 in a real browser (UC-49, FR-13, D-1; task 30.2).
 *
 * **The one suite here where nothing is seeded.** Every other authenticated journey calls
 * `grantMembership` because no route founded an organization from the UI; this is that route. So
 * the cleanup runs the other way round — `organizationIdsForAccount` asks the database what the
 * journey created, through the same policy the product reads before a tenant exists.
 *
 * What it proves that a unit test cannot: that §4.3's *none* arm actually reaches this screen, that
 * the write grants the founding membership and points the session at it (task 29.1's third write in
 * the founding transaction), and that the global tier above the screen names the new organization
 * on the very next render — which is `router.refresh()` doing its job, and which would fail
 * silently as "the band is still empty" without it.
 */
const RUN_PREFIX = `e2e-web-found-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const founders: string[] = [];

test.afterAll(async () => {
  for (const email of founders) {
    await cleanupOrganizations(await organizationIdsForAccount(email));
  }
  await cleanupAccounts(RUN_PREFIX);
});

/** A verified account belonging to nothing — §4.3's *none* arm, which is S-04's entry point. */
async function arriveAtCreateOrganization(page: Page, label: string): Promise<string> {
  const email = addressFor(label);
  founders.push(email);

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/create-organization');
  return email;
}

test('a member of nothing founds an organization and lands in it (UC-49, D-1)', async ({ page }) => {
  const email = await arriveAtCreateOrganization(page, 'happy');
  const name = `${RUN_PREFIX} Brutăria`;

  // The band above the form carries no organization yet — S-04's own artboard state, and the
  // reason the screen exists. An exact count, because the name is about to appear exactly once.
  await expect(page.getByRole('button', { name: `Contul dumneavoastră: ${email}` })).toBeVisible();

  // Preselected, because the vocabulary holds one entry: the field states the country without
  // asking anyone to choose from a list of one.
  await expect(page.getByLabel('Țara de înregistrare')).toHaveText(/Republica Moldova/);

  await page.getByLabel('Denumirea juridică').fill(name);
  await page.getByLabel(/E-mail de contact/).fill(`contact-${RUN_PREFIX}@example.md`);
  await page.getByRole('button', { name: 'Creați organizația' }).click();

  // §5's exit. The founding transaction pointed the session here, so `/home` resolves it without
  // this screen naming it in a query string (AD-2, UX-2).
  await page.waitForURL('**/home');

  // D-1 and FR-13, from the outside: the founder is its administrator, so the OA-only screen
  // renders for them — and the global tier names the organization they just created, which is
  // the assertion `router.refresh()` exists to make true.
  await expect(page.getByText(name)).toBeVisible();
  await page.goto('/organization/users');
  await expect(page.getByRole('heading', { name: 'Utilizatori și acces', level: 1 })).toBeVisible();
});

test('a missing legal name is refused inline and in the summary (UX-111)', async ({ page }) => {
  await arriveAtCreateOrganization(page, 'invalid');

  await page.getByRole('button', { name: 'Creați organizația' }).click();

  // Both halves, because they are two obligations: the inline message at the point of entry
  // (UX-20) and the form-level summary that links to it (UX-111). Exactly one of each.
  await expect(page.getByText('Scrieți denumirea juridică a companiei, altfel organizația nu poate fi creată.')).toHaveCount(2);
  await expect(page).toHaveURL(/create-organization/);
});

test('the screen is live in all three locales', async ({ page }) => {
  await arriveAtCreateOrganization(page, 'locales');

  await expect(page.getByRole('heading', { name: 'Configurați-vă organizația', level: 1 })).toBeVisible();

  await page.goto('/en/create-organization');
  await expect(page.getByRole('heading', { name: 'Set up your organisation', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Country of registration')).toHaveText(/Republic of Moldova/);

  await page.goto('/ru/create-organization');
  await expect(page.getByRole('heading', { name: 'Настройте свою организацию', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Страна регистрации')).toHaveText(/Республика Молдова/);
});

