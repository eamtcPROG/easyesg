import { expect, test, type Page } from '@playwright/test';
import { cleanupAccounts, verificationTokenFor, withdrawLegalAcceptance } from './support/db';
import { exactlyPadded } from './support/expansion';
import { PASSWORD } from './support/second-factor';

/**
 * S-43 at +40% (task 195; UX-94, UX-73's three frames) — the documents owed with their standing, the acceptance whose
 * label names them, *Continue*, and what declining comes to: the screen's longest sentences, in its narrowest card.
 *
 * In the `expansion` project for `credentials.expansion.spec.ts`'s recorded reason: only that server runs with
 * `EASYESG_PSEUDOLOCALE=1`. S-43 is reached as the axe scan reaches it, by taking a signed-in account's acceptance away.
 */
const RUN_PREFIX = `task195-x-${process.pid}-${Date.now()}`;

test.afterAll(async () => {
  await cleanupAccounts(RUN_PREFIX);
});

const FRAMES = [
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
  { width: 390, height: 844 },
];

async function owingAcceptance(page: Page): Promise<void> {
  const email = `${RUN_PREFIX}@example.md`;

  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Am citit și accept/ }).check();
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel(exactlyPadded('Parolă')).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/create-organization');

  await withdrawLegalAcceptance({ email });
}

test('S-43 tolerates +40% at every frame', async ({ page }) => {
  await owingAcceptance(page);
  await page.goto('/accept-terms');

  // Reading spends nothing, so one account serves the three frames.
  for (const frame of FRAMES) {
    await page.setViewportSize(frame);

    // The padded catalogue reached S-43 itself — its own heading, not merely some string on the page.
    await expect(page.getByRole('heading', { level: 1, name: exactlyPadded('Acceptați termenii') })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await expect(page.getByRole('checkbox', { name: /Am citit și accept/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuați/ })).toBeVisible();
  }
});
