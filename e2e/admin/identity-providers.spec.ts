import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { restoreIdentityProviderSeed } from '../web/support/provider-config';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-18 and S-01 as one journey across both applications (task 67.11; UC-70, FR-82) — against the built console,
 * the standalone tenant app and the real api.
 *
 * What only this suite can prove is §5.2 A-18's exit, *the effect is visible on S-01*: an operator registers Google
 * by saving its client id, enables it, and the tenant sign-in screen offers it — with no redeploy and no restart —
 * then disables it past the confirmation that names who it reaches, and the button is gone. On the way it holds the
 * screen to the task row's one obligation about the secret: **it says the server holds one, and where it is set,
 * and never shows it**. The api suite proves the rules; this proves the two screens agree about what happened.
 *
 * **What it needs and does not create**: a Google client secret in the api's environment and http admitted for a
 * local redirect address — both from `apps/api/.env`, which the api loads and CI copies from `.env.example`, as
 * `e2e/web/social.spec.ts` already relies on. The seed payload is republished afterwards.
 */
const RUN_PREFIX = `e2e-providers-${process.pid}-${Date.now()}`;
const WEB_ORIGIN = 'http://localhost:3100';
const OPERATOR = `${RUN_PREFIX}-pa@easyesg.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const CLIENT_ID = `${RUN_PREFIX}-client`;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.afterAll(async () => {
  await restoreIdentityProviderSeed('google');
  await cleanupOperators(RUN_PREFIX);
});

/** UC-68 through A-01's two steps. */
async function signIn(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(OPERATOR);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuați' }).click();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(TOTP_SECRET));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
  await page.waitForURL('**/organizations');
}

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
};

test('an operator registers Google, enables it onto the sign-in screen, and disables it off again', async ({
  page,
  browser,
}) => {
  provisionOperator({
    email: OPERATOR,
    password: PASSWORD,
    totpSecret: TOTP_SECRET,
    role: OPERATOR_ROLE.PLATFORM_ADMINISTRATOR,
  });
  await signIn(page);

  // A-18 is the platform section's fourth destination (task 67.11's nav entry).
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Furnizori de identitate' })
    .click();
  await page.waitForURL('**/identity-providers');
  await expect(page.getByRole('heading', { level: 1, name: 'Furnizori de identitate' })).toBeVisible();

  await page.getByRole('button', { name: 'Google', exact: true }).click();
  await page.waitForURL(/[?&]provider=google/u);
  const record = page.getByRole('complementary', { name: 'Fișa furnizorului Google' });

  // The half the screen cannot edit: held, where it is set, and the secret itself nowhere on the page.
  await expect(record.getByText('Serverul deține secretul')).toBeVisible();
  await expect(record.getByText('AUTH_SOCIAL_GOOGLE_CLIENT_SECRET', { exact: true })).toBeVisible();
  const secret = process.env.AUTH_SOCIAL_GOOGLE_CLIENT_SECRET ?? 'devonly-google-secret';
  expect(await page.content()).not.toContain(secret);

  // The seed ships no client id, so the provider cannot be enabled yet, and the record says why before the click.
  await expect(record.getByText('Nu poate fi activat încă: lipsește identificatorul clientului.')).toBeVisible();
  await expect(record.getByRole('button', { name: 'Activați furnizorul' })).toBeDisabled();

  // Registering Google is saving its first client id.
  await record.getByLabel('Identificatorul clientului').fill(CLIENT_ID);
  await record.getByLabel('Adresele de întoarcere').fill(`${WEB_ORIGIN}/auth/social/google/callback`);
  await record.getByRole('button', { name: 'Salvați configurarea' }).click();
  await expect(page.getByText('Configurarea furnizorului Google a fost salvată și este în vigoare.')).toBeVisible();
  await expect(record.getByLabel('Identificatorul clientului')).toHaveValue(CLIENT_ID);

  await record.getByRole('button', { name: 'Activați furnizorul' }).click();
  await expect(page.getByText('Furnizorul Google este activat și apare pe pagina de autentificare.')).toBeVisible();

  // §5.2 A-18's exit: the effect is visible on S-01, to a visitor holding no session of either realm.
  const visitor = await browser.newContext();
  const signInScreen = await visitor.newPage();
  await signInScreen.goto(`${WEB_ORIGIN}/sign-in`);
  await expect(signInScreen.getByRole('link', { name: 'Continuați cu Google' })).toBeVisible();

  // UX-70: the disable names the provider and what it leaves every account able to do.
  await record.getByRole('button', { name: 'Dezactivați furnizorul' }).click();
  const dialogue = page.getByRole('alertdialog');
  await expect(dialogue.getByRole('heading', { name: 'Dezactivați furnizorul Google?' })).toBeVisible();
  await expect(dialogue.getByText(/Nimeni nu este deconectat/u)).toBeVisible();
  await expectNoAxeViolations(page);

  await dialogue.getByRole('button', { name: 'Dezactivați', exact: true }).click();
  await expect(page.getByText('Furnizorul Google este dezactivat și nu mai apare pe pagina de autentificare.')).toBeVisible();

  await signInScreen.reload();
  await expect(signInScreen.getByRole('link', { name: 'Continuați cu Google' })).toHaveCount(0);
  await visitor.close();

  // The log names what was acted on by its provider — a configuration version has no address.
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Conturi de administrator' })
    .click();
  await page.waitForURL('**/accounts');
  const log = page.getByRole('table', { name: 'Intrările jurnalului de sistem, cele mai noi primele' });
  await expect(log.getByRole('row').filter({ hasText: 'A dezactivat un furnizor de identitate' }).first()).toContainText(
    'Google',
  );
});
