import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  verificationTokenFor,
} from './support/db';
import { PASSWORD, codeFor, enrolFactor, presentPassword } from './support/second-factor';
import { signOut } from './support/session';

/**
 * S-28 — credentials and linked identities (task 27.7), from the browser.
 *
 * What is worth a browser journey here, rather than a unit spec, is the two things only a real
 * round trip can show: **the password change actually changes the password** (the new one signs in
 * and the old one does not), and **the second factor actually challenges** — S-01 asks for a code
 * afterwards, which is the whole point of the screen and involves three tasks' code agreeing.
 *
 * The linking flow is driven in `social.spec.ts`, which runs the OIDC stub — **since task 171**. Until then it was
 * deliberately not driven anywhere in the browser, on the argument that sign-in exercised the same two Route Handlers;
 * but the link completes by its own path — the re-sealed cookie, the Server Action, the authenticated route — and it
 * failed for every Google user while every suite was green. What this suite asserts is that the section renders and
 * offers the link.
 */
const RUN_PREFIX = `task27-${process.pid}-${Date.now()}`;
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
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` }));

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
  return email;
}

test('the screen rests as a row per way in, dated from the api, closing on the last way in', async ({ page }) => {
  await signedIn(page, 'sections');
  await page.goto('/account/credentials');

  await expect(page.getByRole('heading', { name: 'Credențiale și identități asociate', level: 1 })).toBeVisible();
  // Regions labelled by their own headings, each at rest (task 169; the artboard): no field asks for anything yet.
  const password = page.getByRole('region', { name: 'Parolă' });
  await expect(password).toBeVisible();
  // The date is `GET /account/password`'s — registered moments ago, so today's year is the one drawn.
  await expect(password.getByText(/^Schimbată ultima dată pe \d{1,2} \p{L}+ \d{4}\.$/u)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Verificare în doi pași' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Identități asociate' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Asociați Google' })).toBeVisible();
  await expect(page.getByLabel('Parola actuală')).toHaveCount(0);
  // A password and nothing linked: the note names the password as the one way in, before anyone tries to remove it.
  await expect(page.getByText('Parola este singura dumneavoastră cale de acces', { exact: false })).toBeVisible();

  // The rail runs the page's full height and the footer spans it below (24 Sep 2026, owner's review). Measured in a
  // window tall enough that S-28 at rest is shorter than it — the case where the rail used to stop at the record's end,
  // above a footer at the foot of the page. At the suite's own window the record is taller than the viewport, and the
  // rail meets the footer with or without the stretch (found by this check's first run).
  await page.setViewportSize({ width: 1440, height: 1600 });
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  const rail = await page.getByRole('navigation', { name: 'Contul dumneavoastră' }).locator('..').boundingBox();
  const foot = await footer.boundingBox();
  const viewport = page.viewportSize();
  expect(rail && foot && Math.abs(rail.y + rail.height - foot.y)).toBeLessThanOrEqual(1);
  // And the footer at the foot of the viewport, which is what makes the case above a short page's.
  expect(foot && viewport && Math.abs(foot.y + foot.height - viewport.height)).toBeLessThanOrEqual(1);
});

test('changing the password works, and the old one stops working (FR-7)', async ({ page }) => {
  const email = await signedIn(page, 'password');
  await page.goto('/account/credentials');

  const section = page.getByRole('region', { name: 'Parolă' });
  // The row opens in place, and the current password is ITS field since task 169 — one row open, one field on the
  // screen. Unscoped on purpose: were a second field with this label to appear anywhere, this fills nothing and the
  // test says so.
  await section.getByRole('button', { name: 'Schimbați parola' }).click();
  await page.getByLabel('Parola actuală').fill(PASSWORD);
  await section.getByLabel('Parola nouă').fill(NEXT_PASSWORD);
  await section.getByRole('button', { name: 'Salvați parola nouă' }).click();

  await expect(page.getByText('Parola a fost schimbată')).toBeVisible();

  // The session that made the change survives — FR-7's "other", seen from the browser.
  await expect(page).toHaveURL(/\/account\/credentials/);

  // **And leaving is how the form is reached** (task 112): a screen that issues a session refuses a
  // caller who holds one, so this used to arrive at the reader's home with nothing to fill.
  await signOut(page, email);
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(NEXT_PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  // **"and the old one stops working" — the half this test is named for and never asserted**
  // (found by task 112's gate review, which read the block the sign-out was added to). Everything
  // above proves the NEW password works; an API that went on accepting the old one left it green.
  //
  // **It is not FR-7's second clause**, which is *"with optional termination of their other active
  // sessions"* and is a different behaviour — this is the unstated property a password change is
  // for at all, which the test's own name claims and no check anywhere held. Three sign-in attempts
  // on one account, inside §12.5.6's five-per-fifteen-minutes budget.
  await signOut(page, email);
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();

  await expect(page.getByText('Autentificare nereușită')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
});

test('a wrong current password is refused in the API’s own words', async ({ page }) => {
  await signedIn(page, 'refusal');
  await page.goto('/account/credentials');

  const section = page.getByRole('region', { name: 'Parolă' });
  await section.getByRole('button', { name: 'Schimbați parola' }).click();
  await page.getByLabel('Parola actuală').fill('Gresita123!');
  await section.getByLabel('Parola nouă').fill(NEXT_PASSWORD);
  await section.getByRole('button', { name: 'Salvați parola nouă' }).click();

  // The refusal is the API's three-part text, not a sentence this screen wrote — the catalogue
  // key `identity.totp.reauthentication_failed`, which task 27.6's gate now guarantees exists —
  // and it is read inside the row it refused, which stays open (task 169).
  await expect(section.getByText(/Parola actuală nu este corectă/)).toBeVisible();
  await expect(section.getByLabel('Parola nouă')).toBeVisible();
});

test('turning on the second factor makes sign-in ask for a code (UC-193 → UC-194)', async ({
  page,
}) => {
  const email = await signedIn(page, 'factor');
  const { uri } = await enrolFactor(page, { email, password: PASSWORD });

  // And the point of all of it. **This is the journey task 27.3 broke and nobody could see**: the
  // API started answering a challenge where a session used to be, and until the web tier learned
  // the second shape, enrolling a factor turned the next sign-in into a crash.
  await presentPassword(page, { email, password: PASSWORD });
  await page.waitForURL('**/sign-in/factor');
  await expect(page.getByRole('heading', { name: 'Confirmați că sunteți dumneavoastră', level: 1 })).toBeVisible();

  // The six cells hold their height while empty (24 Sep 2026, found by the project owner): an empty cell had no line
  // box and collapsed to its borders, so the field drew as six underlines until a character was typed. The real input
  // is laid over the cells, so its height IS theirs — measured before anything is typed, where the defect lived.
  const codeInput = page.getByLabel('Codul din aplicația de autentificare');
  expect((await codeInput.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);

  // From the factor the phone scanned off S-28 (task 143), which is the only factor a real user has.
  await codeInput.fill(codeFor(uri));
  await page.getByRole('button', { name: 'Confirmați și intrați în cont' }).click();
  await page.waitForURL('**/home');
});

test('a recovery code answers the same step, and is spent by doing so (UC-195)', async ({
  page,
}) => {
  const email = await signedIn(page, 'recovery');
  const { recovery } = await enrolFactor(page, { email, password: PASSWORD });

  await presentPassword(page, { email, password: PASSWORD });
  await page.waitForURL('**/sign-in/factor');

  // The other affordance, offered rather than hidden: UX-108's point is that a person without
  // their authenticator must not need a second device to get in.
  await page.getByRole('button', { name: /Folosiți un cod de recuperare/ }).click();
  await page.getByLabel('Cod de recuperare').fill(recovery[0]);
  await page.getByRole('button', { name: 'Confirmați și intrați în cont' }).click();
  await page.waitForURL('**/home');

  // Single-use, proven by presenting it again rather than by reading the table.
  await presentPassword(page, { email, password: PASSWORD });
  await page.waitForURL('**/sign-in/factor');
  await page.getByRole('button', { name: /Folosiți un cod de recuperare/ }).click();
  await page.getByLabel('Cod de recuperare').fill(recovery[0]);
  await page.getByRole('button', { name: 'Confirmați și intrați în cont' }).click();

  // Refused in the API's own three-part words, and the reader stays on the step to try another —
  // the challenge is deliberately not single-use, so a wrong answer does not cost them the password.
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in\/factor/);
  await expect(page.getByLabel('Cod de recuperare')).toBeVisible();
});

test('the staged step is live in all three locales', async ({ page }) => {
  const email = await signedIn(page, 'factor-locales');
  await enrolFactor(page, { email, password: PASSWORD });

  // One password presentation, three renders: the challenge cookie is path-wide and carries no
  // language, so the step is reachable in every locale from the same held challenge — which is
  // also the cheapest way to assert this without spending three sign-in attempts against
  // §12.5.6's five-per-fifteen-minutes budget for one account.
  await presentPassword(page, { email, password: PASSWORD });
  await page.waitForURL('**/sign-in/factor');

  for (const [path, title] of [
    ['/sign-in/factor', 'Confirmați că sunteți dumneavoastră'],
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
    ['/account/credentials', 'Credențiale și identități asociate'],
    ['/en/account/credentials', 'Credentials and linked identities'],
    ['/ru/account/credentials', 'Учётные данные и связанные аккаунты'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  }
});
