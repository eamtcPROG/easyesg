import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, dropCredential, moveIntoSetup, verificationTokenFor } from './support/db';
import { exactlyPadded } from './support/expansion';
import { PASSWORD } from './support/second-factor';

/**
 * S-36 at +40% (task 155; UX-94, UX-73's three frames) — both steps, since they are two forms of
 * different lengths: the password step carries its requirement list, the second step two name fields
 * and a select — and **the link path's password step**, a third form, with its own opening sentence
 * naming the address and the *keep me signed in* checkbox the session step does not carry.
 *
 * In the `expansion` project for `credentials.expansion.spec.ts`'s recorded reason: only that server
 * runs with `EASYESG_PSEUDOLOCALE=1`, so this is the one place the padded catalogue arrives. The
 * session steps are reached by moving a signed-in account into setup, which is how S-36 is reached
 * without the provider stub; the screen reads the account's setup from the API, so the session cookie's
 * own status does not matter. The link step is reached as the axe scan reaches it: a registration whose
 * credential is removed before its confirmation is followed.
 */
const RUN_PREFIX = `task155-x-${process.pid}-${Date.now()}`;

test.afterAll(async () => {
  await cleanupAccounts(RUN_PREFIX);
});

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

/** A registration left at its confirmation, as S-01 leaves it. */
async function registered(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
}

async function signedIn(page: Page, label: string): Promise<string> {
  const email = `${RUN_PREFIX}-${label}@example.md`;

  await registered(page, email);
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/create-organization');
  return email;
}

/**
 * The padded catalogue reached S-36 itself — its own heading, not merely some string on the page —
 * nothing scrolls sideways, and the step's one primary action survived.
 */
async function tolerates(page: Page, action: RegExp): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: exactlyPadded('Finalizați-vă contul') }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await expect(page.getByRole('button', { name: action })).toBeVisible();
}

for (const frame of FRAMES) {
  test(`S-36 tolerates +40% at ${frame.width}, on both steps`, async ({ page }) => {
    const email = await signedIn(page, `x${frame.width}`);
    await page.setViewportSize(frame);

    // The second step first, while the credential is still there to hold.
    await moveIntoSetup({ email, holdsPassword: true });
    await page.goto('/complete-account');
    await tolerates(page, /Salvați și continuați/);

    await moveIntoSetup({ email, holdsPassword: false });
    await page.goto('/complete-account');
    await tolerates(page, /Salvați parola/);
  });
}

test('S-36’s link-path password step tolerates +40% at every frame', async ({ page }) => {
  const email = `${RUN_PREFIX}-grant@example.md`;

  await registered(page, email);
  await dropCredential({ email });
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await page.waitForURL('**/register/password');

  // Rendering spends nothing, so one confirmation serves the three frames.
  for (const frame of FRAMES) {
    await page.setViewportSize(frame);
    await tolerates(page, /Salvați parola/);
  }
});
