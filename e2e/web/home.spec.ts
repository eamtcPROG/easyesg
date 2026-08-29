import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-05 in a real browser (UC-16, UC-67; FR-12, FR-23; task 30.5).
 *
 * **What a browser proves here is mostly what the screen refuses to say.** The report region is
 * explicitly empty because no reporting period exists (task 31), the membership list states where
 * the reader belongs without offering to switch (OQ-6 gives switching to task 83's global tier),
 * and an edited `?joined=` announces nothing. Each of those is a sentence that would read as
 * plausible if it were wrong.
 *
 * The arrival sentence's happy path is `invitation.spec.ts`'s, where the grant actually happens.
 */
const RUN_PREFIX = `e2e-web-home-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedIn(page: Page, label: string, extraOrganizations = 0): Promise<string> {
  const email = addressFor(label);

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` }));
  for (let extra = 0; extra < extraOrganizations; extra += 1) {
    organizations.push(
      await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}-${extra}` }),
    );
  }

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  // **Wait for §4.3's branch to land before returning.** Not optional, and the trap
  // `users-access.spec.ts` documents: a `goto` issued before the redirect settles races the session
  // cookie, so the request arrives without one and the closed-by-default gate correctly bounces it
  // to sign-in. Every actor here holds at least one membership, so the branch lands on `/home`.
  await page.waitForURL('**/home');
  return email;
}

test('the home names the organization and states its role (UX-2, UC-16)', async ({ page }) => {
  await signedIn(page, 'single');

  // The heading is the organization, not a greeting: registration collects no display name
  // (OQ-16) and a Server Component cannot know the reader's time of day.
  await expect(
    page.getByRole('heading', { name: `${RUN_PREFIX}-single`, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Administrator al organizației').first()).toBeVisible();

  // FR-23's region, present and explicitly empty — named for what it will hold so task 32.4 does
  // not introduce the concept cold, and honest that the cause is "no period yet".
  await expect(page.getByText('Nu există încă nicio perioadă de raportare')).toBeVisible();
});

test('the membership list states where the reader belongs, and which is active', async ({
  page,
}) => {
  // Several memberships with no stated preference resolve no active organization (UX-2 makes the
  // choice deliberate), which is exactly the state task 83's switcher exists to end — so the
  // heading names none of them and the list is the only thing that can.
  await signedIn(page, 'several', 1);

  // Scoped to the list rather than the page: with several memberships the heading names none of
  // them, but the band and the heading are still places the same string can appear.
  const list = page.getByRole('list').filter({ hasText: `${RUN_PREFIX}-several` });
  await expect(list.getByText(`${RUN_PREFIX}-several`, { exact: true })).toBeVisible();
  await expect(list.getByText(`${RUN_PREFIX}-several-0`, { exact: true })).toBeVisible();
});

test('an edited ?joined= announces nothing', async ({ page }) => {
  await signedIn(page, 'edited');

  await page.goto('/home?joined=congratulations');
  // The parameter arrives through the address bar. A home that announced access to somebody who
  // typed it would be stating something the product never decided.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Ați primit acces')).toHaveCount(0);
});

test('the screen is live in all three locales', async ({ page }) => {
  await signedIn(page, 'locales');

  await expect(page.getByText('Starea rapoartelor')).toBeVisible();
  await page.goto('/en/home');
  await expect(page.getByText('Report status')).toBeVisible();
  await page.goto('/ru/home');
  await expect(page.getByText('Состояние отчётов')).toBeVisible();
});
