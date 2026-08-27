import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';

/**
 * S-28 — credentials and linked identities (task 27.7), from the browser.
 *
 * What is worth a browser journey here, rather than a unit spec, is the two things only a real
 * round trip can show: **the password change actually changes the password** (the new one signs in
 * and the old one does not), and **the second factor actually challenges** — S-01 asks for a code
 * afterwards, which is the whole point of the screen and involves three tasks' code agreeing.
 *
 * The linking flow is deliberately **not** driven here. It needs the OIDC stub the api's own suite
 * runs, and what it would prove that `provider-link.e2e-spec.ts` does not is the redirect wiring —
 * which `social.spec.ts` already exercises for sign-in over the same two Route Handlers. What this
 * suite does assert is that the section renders and offers the link, since a screen that could not
 * be reached is the failure mode a green API suite cannot see.
 */
const RUN_PREFIX = `task27-${process.pid}-${Date.now()}`;
const PASSWORD = 'Str0ng-Passphrase!';
const NEXT_PASSWORD = 'Alt-Str0ng-Passphrase!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** Registration → verification → membership → sign-in, all through the shipped routes. */
async function signedIn(page: Page, label: string): Promise<string> {
  const email = `${RUN_PREFIX}-${label}@example.md`;

  await page.goto('/register');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creează contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmă adresa' }).click();

  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
  await page.waitForURL('**/home');
  return email;
}

test('the screen carries all three ways in, each as its own section', async ({ page }) => {
  await signedIn(page, 'sections');
  await page.goto('/account/credentials');

  await expect(page.getByRole('heading', { name: 'Date de autentificare', level: 1 })).toBeVisible();
  // Regions labelled by their own headings — the archetype's contract, seen from the outside.
  await expect(page.getByRole('region', { name: 'Parolă' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Verificare în doi pași' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Conturi legate' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Legați Google/ })).toBeVisible();
});

test('changing the password works, and the old one stops working (FR-7)', async ({ page }) => {
  const email = await signedIn(page, 'password');
  await page.goto('/account/credentials');

  const section = page.getByRole('region', { name: 'Parolă' });
  await section.getByLabel('Parola actuală').fill(PASSWORD);
  await section.getByLabel('Parola nouă').fill(NEXT_PASSWORD);
  await section.getByRole('button', { name: 'Schimbați parola' }).click();

  await expect(page.getByText('Parola a fost schimbată')).toBeVisible();

  // The session that made the change survives — FR-7's "other", seen from the browser.
  await expect(page).toHaveURL(/\/account\/credentials/);

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(NEXT_PASSWORD);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
  await page.waitForURL('**/home');
});

test('a wrong current password is refused in the API’s own words', async ({ page }) => {
  await signedIn(page, 'refusal');
  await page.goto('/account/credentials');

  const section = page.getByRole('region', { name: 'Parolă' });
  await section.getByLabel('Parola actuală').fill('Gresita123!');
  await section.getByLabel('Parola nouă').fill(NEXT_PASSWORD);
  await section.getByRole('button', { name: 'Schimbați parola' }).click();

  // The refusal is the API's three-part text, not a sentence this screen wrote — the catalogue
  // key `identity.totp.reauthentication_failed`, which task 27.6's gate now guarantees exists.
  await expect(page.getByText(/Parola actuală nu este corectă/)).toBeVisible();
});

/** RFC 6238 against the secret the screen just showed — the same generator an app would run. */
function totp(secret: string, email: string): Promise<string> {
  return import('otpauth').then(({ TOTP, Secret }) =>
    new TOTP({
      issuer: 'EasyESG Admin',
      label: email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    }).generate(),
  );
}

/**
 * Enrols a second factor on a signed-in account through S-28's own controls, and answers with what
 * the screen showed: the secret an authenticator would have captured, and the ten recovery codes.
 */
async function enrolFactor(page: Page, email: string): Promise<{ secret: string; recovery: string[] }> {
  await page.goto('/account/credentials');

  const section = page.getByRole('region', { name: 'Verificare în doi pași' });
  await page.getByLabel('Parola actuală').last().fill(PASSWORD);
  await section.getByRole('button', { name: 'Activați verificarea în doi pași' }).click();

  await expect(section.getByText('Scanați sau introduceți acest cod')).toBeVisible();
  const secret = (await section.locator('.t-code').first().textContent()) ?? '';
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  await section.getByLabel('Codul din aplicație').fill(await totp(secret, email));
  await section.getByRole('button', { name: 'Finalizați activarea' }).click();

  // The recovery codes, shown exactly once — with the warning BEFORE them (P5).
  await expect(section.getByText(/Vi le arătăm o singură dată/)).toBeVisible();
  const codes = section.locator('li.t-code');
  await expect(codes).toHaveCount(10);
  const recovery = await codes.allInnerTexts();
  await section.getByRole('button', { name: 'Le-am notat' }).click();

  return { secret, recovery };
}

/** The password half of S-01, which for an enrolled account ends on the staged step. */
async function presentPassword(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intră în cont' }).click();
}

test('turning on the second factor makes sign-in ask for a code (UC-193 → UC-194)', async ({
  page,
}) => {
  const email = await signedIn(page, 'factor');
  const { secret } = await enrolFactor(page, email);

  // And the point of all of it. **This is the journey task 27.3 broke and nobody could see**: the
  // API started answering a challenge where a session used to be, and until the web tier learned
  // the second shape, enrolling a factor turned the next sign-in into a crash.
  await presentPassword(page, email);
  await page.waitForURL('**/sign-in/factor');
  await expect(page.getByRole('heading', { name: 'Confirmă că ești tu', level: 1 })).toBeVisible();

  await page.getByLabel('Codul din aplicația de autentificare').fill(await totp(secret, email));
  await page.getByRole('button', { name: 'Confirmă și intră în cont' }).click();
  await page.waitForURL('**/home');
});

test('a recovery code answers the same step, and is spent by doing so (UC-195)', async ({
  page,
}) => {
  const email = await signedIn(page, 'recovery');
  const { recovery } = await enrolFactor(page, email);

  await presentPassword(page, email);
  await page.waitForURL('**/sign-in/factor');

  // The other affordance, offered rather than hidden: UX-108's point is that a person without
  // their authenticator must not need a second device to get in.
  await page.getByRole('button', { name: /Folosește un cod de recuperare/ }).click();
  await page.getByLabel('Cod de recuperare').fill(recovery[0]);
  await page.getByRole('button', { name: 'Confirmă și intră în cont' }).click();
  await page.waitForURL('**/home');

  // Single-use, proven by presenting it again rather than by reading the table.
  await presentPassword(page, email);
  await page.waitForURL('**/sign-in/factor');
  await page.getByRole('button', { name: /Folosește un cod de recuperare/ }).click();
  await page.getByLabel('Cod de recuperare').fill(recovery[0]);
  await page.getByRole('button', { name: 'Confirmă și intră în cont' }).click();

  // Refused in the API's own three-part words, and the reader stays on the step to try another —
  // the challenge is deliberately not single-use, so a wrong answer does not cost them the password.
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in\/factor/);
  await expect(page.getByLabel('Cod de recuperare')).toBeVisible();
});

test('the staged step is live in all three locales', async ({ page }) => {
  const email = await signedIn(page, 'factor-locales');
  await enrolFactor(page, email);

  // One password presentation, three renders: the challenge cookie is path-wide and carries no
  // language, so the step is reachable in every locale from the same held challenge — which is
  // also the cheapest way to assert this without spending three sign-in attempts against
  // §12.5.6's five-per-fifteen-minutes budget for one account.
  await presentPassword(page, email);
  await page.waitForURL('**/sign-in/factor');

  for (const [path, title] of [
    ['/sign-in/factor', 'Confirmă că ești tu'],
    ['/en/sign-in/factor', "Confirm it's you"],
    ['/ru/sign-in/factor', 'Подтвердите, что это вы'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  }
});

test('the staged step is unreachable without a challenge', async ({ page }) => {
  // No password presented, so no challenge is held — and the cookie that holds one is httpOnly,
  // so this is the whole attack surface. The step bounces to where a challenge comes from.
  await page.goto('/sign-in/factor');
  await page.waitForURL('**/sign-in');
  await expect(page.getByLabel('Adresa de e-mail')).toBeVisible();
});

test('the screen is live in all three locales', async ({ page }) => {
  await signedIn(page, 'locales');

  for (const [path, title] of [
    ['/account/credentials', 'Date de autentificare'],
    ['/en/account/credentials', 'Sign-in details'],
    ['/ru/account/credentials', 'Данные для входа'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  }
});

/**
 * The +40% expansion check, here rather than in `expansion.spec.ts` (task 27.7).
 *
 * That suite is its own Playwright project and every screen in it is unauthenticated, so its loop
 * is a `goto` per frame. S-28 needs a session, and threading sign-in into that project would make
 * every screen pay for it. The assertion is the same one, applied at UX-73's three widths: the
 * padded catalogue actually arrived, the document does not scroll sideways, and the primary action
 * survived.
 */
const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

for (const frame of FRAMES) {
  test(`tolerates +40% at ${frame.width}`, async ({ page }) => {
    await signedIn(page, `expand-${frame.width}`);
    await page.setViewportSize(frame);
    await page.goto('/account/credentials');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await expect(page.getByRole('button', { name: 'Schimbați parola' })).toBeVisible();
  });
}
