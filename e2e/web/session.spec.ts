import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  endSessionsOf,
  grantMembership,
  moveIntoSetup,
  passwordResetTokenFor,
  verificationTokenFor,
} from './support/db';
import { accountTrigger, signOut } from './support/session';

/**
 * Task 22's stated deliverable, literally: **browser sign-in/out against the public API** —
 * plus the S-02 reset surfaces whose API task 21 shipped for exactly this screen pair.
 *
 * The journey runs in Romanian through the shipped screens against the real api and database.
 * Tokens are read the way the registration suite reads them — from the outbox row, as
 * `esg_worker`, because the raw token exists nowhere else (OQ-54). What the browser never
 * sees, and this suite proves by omission: no access or refresh token in any URL, and the one
 * cookie is httpOnly — `document.cookie` stays empty of it.
 */
const RUN_PREFIX = `e2e-web-session-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';
const NEW_PASSWORD = 'ParolaNoua456!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** UC-01 + UC-03 through the screens, as the registration suite proved them. */
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

async function signIn(
  page: Page,
  email: string,
  password: string,
  options: { remember?: boolean } = {},
): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(password);
  if (options.remember) {
    await page.getByLabel('Țineți-mă autentificat pe acest dispozitiv').check();
  }
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
}

/** The session cookie as the BROWSER holds it — `expires` is what persistence actually means. */
async function sessionCookie(page: Page) {
  const jar = await page.context().cookies();
  const found = jar.find((c) => c.name === 'easyesg_session');
  expect(found, 'no session cookie was set').toBeDefined();
  return found!;
}

test('a user signs in, holds an httpOnly session, and signs out (UC-04, UC-06)', async ({
  page,
}) => {
  const email = addressFor('happy');
  await registerAndVerify(page, email);

  await signIn(page, email, PASSWORD);

  // §4.3's branch, real since task 25.4: this account belongs to nothing, so it lands on S-04
  // rather than on the home it has no organization to fill.
  await page.waitForURL('**/create-organization');
  // The global tier's account corner names the signed-in address (task 30.1, replacing task 22's
  // interim strip). The band carries no organization region here, which is S-04's own artboard
  // state and `global-tier.spec.ts`'s subject.
  await expect(accountTrigger(page, { email })).toBeVisible();

  // AD-9's whole point, asserted from inside the browser: the session cookie is httpOnly and
  // carries no readable token — browser JavaScript sees nothing of it.
  const readable = await page.evaluate(() => document.cookie);
  expect(readable).not.toContain('easyesg_session');

  // Sign-out lives in the user menu since task 30.1 (§4.2). Two clicks rather than one, and the
  // extra one is the deliverable: §4.2 puts sign-out behind the account corner on every
  // authenticated screen, so a journey that could still reach it directly would mean the interim
  // strip was left behind rather than replaced.
  await signOut(page, email);

  // The session is gone server-side too: the guarded route bounces straight back.
  await page.goto('/home');
  await page.waitForURL('**/sign-in?**');
});

/**
 * UX-38's deep-link contract. **The account is given a membership since task 25.4**, and that is
 * the test staying true rather than being adjusted to pass: `?return=` is honoured only where an
 * organization resolves, so without one this would now assert S-04 and prove nothing about the
 * return path. `post-sign-in.spec.ts` owns the override case.
 */
test('a guarded route redirects to sign-in and returns after it (UX-38)', async ({ page }) => {
  const email = addressFor('return');
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} Return` }));

  await page.goto('/reports');
  await page.waitForURL('**/sign-in?return=%2Freports');

  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();

  await page.waitForURL('**/reports');
});

test('a wrong password answers the uniform document, as received (NFR-64)', async ({ page }) => {
  const email = addressFor('wrong');
  await registerAndVerify(page, email);

  await signIn(page, email, 'GresitTotal999!');

  // The api's resolved title, rendered untouched — no client-side sentence for a slug.
  await expect(page.getByText('Autentificare nereușită')).toBeVisible();
});

test('a correct password on an unverified account names verification as the blocker (OQ-57)', async ({
  page,
}) => {
  const email = addressFor('unverified');
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');

  await signIn(page, email, PASSWORD);

  await expect(page.getByText('Adresă neconfirmată')).toBeVisible();
  await page.getByRole('link', { name: 'Mergeți la confirmarea adresei' }).click();
  await page.waitForURL('**/verify');
  // The address rode the same hand-off registration uses; the challenge states it.
  await expect(page.getByText(email)).toBeVisible();
});

test('the reset flow: uniform request, stated consequence, new password signs in (UC-08, UC-09)', async ({
  page,
}) => {
  const email = addressFor('reset');
  await registerAndVerify(page, email);

  await page.goto('/reset');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByRole('button', { name: 'Trimiteți linkul' }).click();
  // Uniform: the confirmation asserts only the conditional fact (NFR-64).
  await expect(page.getByText('Cererea a fost înregistrată')).toBeVisible();

  const token = await passwordResetTokenFor(email);
  await page.goto(`/set-password?token=${token}`);

  // P5: the consequence is stated BEFORE it happens.
  await expect(page.getByText('Toate sesiunile existente vor fi închise')).toBeVisible();

  await page.getByLabel('Parola nouă').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Salvați parola nouă' }).click();
  await expect(page.getByText('Parola a fost schimbată')).toBeVisible();

  await page.getByRole('link', { name: 'Mergeți la autentificare' }).click();
  await page.waitForURL('**/sign-in');
  await signIn(page, email, NEW_PASSWORD);
  // No membership, so §4.3 sends them to S-04 — the new password worked, which is the claim.
  await page.waitForURL('**/create-organization');
});

test('a bare set-password arrival explains itself and offers the request route', async ({
  page,
}) => {
  await page.goto('/set-password');
  await expect(page.getByText('Linkul este incomplet')).toBeVisible();
  await page.getByRole('link', { name: 'Cereți un link nou' }).click();
  await page.waitForURL('**/reset');
});

/**
 * S-02 worded for the account its link was sent to (task 155; §12.5.6's task-155 row (8)). The worker
 * adds `intent=setup` for an account holding no password, and this is the web tier's end of that wire —
 * the parameter's name and value read on a real page, the heading, label and action all taking the first
 * password's words. Rendering spends nothing, so any token will do; the reset wording is the control.
 */
test('a set-password link for an account holding no password is worded as setting its first (task 155)', async ({
  page,
}) => {
  await page.goto('/set-password?token=not-spent-by-rendering&intent=setup');
  await expect(page.getByRole('heading', { level: 1, name: 'Setați o parolă', exact: true })).toBeVisible();
  await expect(page.getByLabel('Parola', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvați parola', exact: true })).toBeVisible();

  await page.goto('/set-password?token=not-spent-by-rendering');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Setați o parolă nouă', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvați parola nouă', exact: true })).toBeVisible();
});

/**
 * S-01's *Keep me signed in on this device* (§12.5.6, OQ-35 amended 4 Sep 2026), across the two
 * halves that have to agree — and they are held by different systems, which is the whole reason
 * this is a browser test rather than two unit tests.
 *
 * The **API** decides the session's lifetime from the `remember` field and answers a
 * `refreshTokenExpiresAt`; the **web tier** decides whether the cookie carries a `Max-Age` at all.
 * A defect in either alone is invisible: a persistent cookie over a 12 h session signs the reader
 * out on their next visit with no explanation, and a session cookie over a 30 d session throws away
 * a month of it the moment the browser closes. Playwright reports `expires === -1` for a
 * browser-session cookie, which is the only place that distinction is observable at all.
 */
test.describe('session persistence (OQ-35)', () => {
  test('declining leaves a cookie that dies with the browser, capped at 12 hours', async ({
    page,
  }) => {
    const email = addressFor('not-remembered');
    await registerAndVerify(page, email);

    await signIn(page, email, PASSWORD);
    await page.waitForURL('**/create-organization');

    const cookie = await sessionCookie(page);
    // -1 is Playwright's spelling of "no expiry attribute" — a browser-session cookie.
    expect(cookie.expires).toBe(-1);
    // Still httpOnly, and still nothing readable: the shorter window changes the lifetime and
    // nothing else about how the session is held.
    expect(cookie.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('easyesg_session');
  });

  test('ticking it persists the cookie, and for the longer window', async ({ page }) => {
    const email = addressFor('remembered');
    await registerAndVerify(page, email);

    await signIn(page, email, PASSWORD, { remember: true });
    await page.waitForURL('**/create-organization');

    const cookie = await sessionCookie(page);
    expect(cookie.expires).toBeGreaterThan(0);

    // **The bound is asserted as a range, not a value.** The clock moves between the API stamping
    // the expiry and this line reading it, so an equality would be flaky by construction — and the
    // claim that matters is which POLICY was applied, which a day's worth of margin settles
    // absolutely: 12 h and 7 days cannot both satisfy it.
    const secondsLeft = cookie.expires - Date.now() / 1000;
    const day = 24 * 60 * 60;
    expect(secondsLeft).toBeGreaterThan(6 * day);
    expect(secondsLeft).toBeLessThanOrEqual(7 * day);
  });
});

// ── A session the api has ended (task 160) ──────────────────────────────────────────────────────

const SIGN_IN_HEADING = 'Autentificați-vă';

/** A verified account with one organization, signed in and on its home. */
async function aSignedInMember(page: Page, label: string): Promise<string> {
  const email = addressFor(label);
  await registerAndVerify(page, email);
  organizations.push(await grantMembership({ email, organizationName: `${RUN_PREFIX} ${label}` }));
  await signIn(page, email, PASSWORD);
  await page.waitForURL('**/home');
  return email;
}

/** S-02's reset, from the request to the success, for `email` — in whatever session the page holds. */
async function resetPasswordOf(page: Page, email: string): Promise<void> {
  await page.goto('/reset');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByRole('button', { name: 'Trimiteți linkul' }).click();
  await expect(page.getByText('Cererea a fost înregistrată')).toBeVisible();
  await page.goto(`/set-password?token=${await passwordResetTokenFor(email)}`);
  await page.getByLabel('Parola nouă').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Salvați parola nouă' }).click();
  await expect(page.getByText('Parola a fost schimbată')).toBeVisible();
}

/**
 * **The finding, from S-02's side.** A reset ends every session of its account, this browser's included —
 * and the cookie used to outlive it, so *Go to sign in* met UX-136's gate, which resolved §4.3's branch
 * with a refused token and landed on S-35 telling the reader that sign-in had succeeded. The action now
 * clears the cookie, and the gate would serve the form even if it had not.
 */
test('a reset finished while signed in as the same account reaches the sign-in form (task 160)', async ({
  page,
}) => {
  const email = await aSignedInMember(page, 'reset-own');
  await resetPasswordOf(page, email);

  await expect(page.getByRole('button', { name: /^Ieșiți și autentificați-vă/ })).toHaveCount(0);
  expect((await page.context().cookies()).some((c) => c.name === 'easyesg_session')).toBe(false);

  await page.getByRole('link', { name: 'Mergeți la autentificare' }).click();
  await page.waitForURL('**/sign-in');
  await expect(page.getByRole('heading', { name: SIGN_IN_HEADING })).toBeVisible();
  await signIn(page, email, NEW_PASSWORD);
  await page.waitForURL('**/home');
});

/**
 * **A reset for another account ends only that account's sessions**, so this browser's survives — and the
 * sign-in the success would offer would be turned away to this account's home. It names the account held
 * and offers to switch or to stay; staying continues as that account.
 */
test('a reset finished for another account offers to switch or to stay (task 160)', async ({ page }) => {
  const other = addressFor('reset-other');
  await registerAndVerify(page, other);
  const holder = await aSignedInMember(page, 'reset-holder');

  await resetPasswordOf(page, other);

  await expect(page.getByRole('status')).toContainText(holder);
  await expect(page.getByRole('button', { name: 'Ieșiți și autentificați-vă' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mergeți la autentificare' })).toHaveCount(0);
  await page.getByRole('link', { name: `Continuați ca ${holder}` }).click();
  await page.waitForURL('**/home');
});

/**
 * **A confirmation reached while signed in is always for another address** — a signed-in account is a
 * verified one. The success names both, and switching signs the holder out and opens sign-in, where the
 * confirmed account signs in.
 */
test('a confirmation reached while signed in as another account offers to switch (task 160)', async ({
  page,
}) => {
  const confirmed = addressFor('confirm-other');
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ion');
  await page.getByLabel('Nume de familie').fill('Rusu');
  await page.getByLabel('E-mail de serviciu').fill(confirmed);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  const holder = await aSignedInMember(page, 'confirm-holder');

  await page.goto(`/verify?token=${await verificationTokenFor(confirmed)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText(confirmed);
  await expect(status).toContainText(holder);
  await expect(page.getByRole('link', { name: `Continuați ca ${holder}` })).toHaveAttribute('href', '/home');
  await expect(page.getByRole('link', { name: 'Mergeți la autentificare' })).toHaveCount(0);

  await page.getByRole('button', { name: `Ieșiți și autentificați-vă ca ${confirmed}` }).click();
  await page.waitForURL('**/sign-in');
  await signIn(page, confirmed, PASSWORD);
  await page.waitForURL('**/create-organization');
});

/**
 * **The cause, on the screens that read.** A session ended on another device leaves this browser's cookie
 * standing until its access token falls due, and every read in that window was answered *could not load*.
 * Every screen now sends the reader to sign in with its address kept — S-35 included, rather than saying
 * sign-in succeeded — and the sign-in gate serves the form. S-28 is asked separately because *sign out
 * other devices* is its own control.
 *
 * **Since task 161 no screen does it**: the api client answers the ending once, for every request, and
 * `/entities/new` is here because task 160's per-screen arms never reached it — a screen that reads during
 * render and was redirected by nothing until the rule moved to the seam.
 */
test('a session ended elsewhere is sent to sign in, and back to the screen asked for (tasks 160, 161)', async ({
  page,
}) => {
  const email = await aSignedInMember(page, 'ended');

  await endSessionsOf({ email });
  await page.goto('/organization-unavailable');
  await page.waitForURL('**/sign-in?**');
  expect(new URL(page.url()).searchParams.get('return')).toBe('/organization-unavailable');
  await expect(page.getByRole('heading', { name: SIGN_IN_HEADING })).toBeVisible();

  await page.goto('/entities/new');
  await page.waitForURL('**/sign-in?**');
  expect(new URL(page.url()).searchParams.get('return')).toBe('/entities/new');

  await page.goto('/reports');
  await page.waitForURL('**/sign-in?**');
  expect(new URL(page.url()).searchParams.get('return')).toBe('/reports');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/reports');

  await endSessionsOf({ email });
  await page.goto('/account/credentials');
  await page.waitForURL('**/sign-in?**');
  expect(new URL(page.url()).searchParams.get('return')).toBe('/account/credentials');
});

/**
 * **Writes meet the same rule** (task 161; the owner's *reads and writes*). The screen rendered while the
 * session held and the save is what finds it gone: the Server Action's write is refused
 * `authentication-required` before any validation, and the api client sends the reader to sign in from
 * inside the action, with the screen's address kept — where task 160 drew the refusal above the form.
 */
test('a save made after the session ended elsewhere is sent to sign in, and back (task 161)', async ({
  page,
}) => {
  const email = await aSignedInMember(page, 'ended-write');
  await page.goto('/organization');
  await page.getByLabel('Localitatea').fill('Bălți');

  await endSessionsOf({ email });
  await page.getByRole('button', { name: 'Salvați modificările' }).click();
  await page.waitForURL('**/sign-in?**');
  expect(new URL(page.url()).searchParams.get('return')).toBe('/organization');
  await expect(page.getByRole('heading', { name: SIGN_IN_HEADING })).toBeVisible();
});

/**
 * **The loop this could have been.** The branch sends a session still in setup to S-36 without reading
 * memberships, and S-36 now sends an ended session to sign in — so, unless the branch asked the setup read
 * too, the gate would send it straight back, and the browser would give up on the redirects. And since task
 * 161 the way back is S-36's own address, which must not come back wrapped in itself.
 */
test('a session in setup that the api has ended reaches the sign-in form, and S-36 again (tasks 160, 161)', async ({
  page,
}) => {
  const email = addressFor('ended-setup');
  await registerAndVerify(page, email);
  await moveIntoSetup({ email, holdsPassword: true });
  await signIn(page, email, PASSWORD);
  await page.waitForURL('**/complete-account**');

  // S-36 holding a way on, so the return below is an address with a return of its own (task 161).
  const heldWayOn = `/complete-account?return=${encodeURIComponent('/reports')}`;
  await endSessionsOf({ email });
  await page.goto(heldWayOn);
  await page.waitForURL('**/sign-in?**');
  expect(new URL(page.url()).searchParams.get('return')).toBe(heldWayOn);
  await expect(page.getByRole('heading', { name: SIGN_IN_HEADING })).toBeVisible();

  // **Back on S-36 with its own way on, not S-36 wrapped in S-36** — the branch wraps an account in setup
  // in S-36's address, and `completeAccountRoute` answers an address that is already S-36's as it is.
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/complete-account?**');
  expect(new URL(page.url()).searchParams.get('return')).toBe('/reports');
});
