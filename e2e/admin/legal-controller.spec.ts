import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { STACK_ORIGIN } from '../stack';
import { settleAnimations } from '../web/support/animations';
import { restoreSlot, snapshotLegalController, type SlotSnapshot } from '../web/support/provider-config';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-21 and S-30 as one journey across both applications (task 75; FR-205 AC-12) — against the built console, the
 * standalone tenant app and the real api.
 *
 * What only this suite can prove is A-21's exit, *the effect is visible on S-30*: an operator corrects the platform
 * operator's registered name, is stopped at the field by an IDNO whose check digit is wrong, saves, and a visitor with no
 * session reads the new name on the terms of service — with no release and no restart — while the log names the save.
 * The api suite proves the refusals; this proves the two screens agree about what happened.
 *
 * **What it needs and does not create**: a readable operator in force, which the test stack's `config:seed` publishes.
 * The slot is put back afterwards, under its own publisher (task 172).
 */
const RUN_PREFIX = `e2e-legal-controller-${process.pid}-${Date.now()}`;
const OPERATOR = `${RUN_PREFIX}-pa@easyesg.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const REGISTERED_NAME = `Operator ${process.pid} SRL`;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The operator in force before the suite, put back after it (task 172). */
let slot: SlotSnapshot | undefined;

test.beforeAll(async () => {
  slot = await snapshotLegalController();
});

test.afterAll(async () => {
  if (slot !== undefined) await restoreSlot(slot);
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

test('an operator corrects the platform operator, and the terms of service name it at once', async ({
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

  // A-21 is the platform section's last destination (`design_spec.md` §4.7).
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Operatorul platformei' })
    .click();
  await page.waitForURL('**/legal-controller');
  await expect(page.getByRole('heading', { level: 1, name: 'Operatorul platformei' })).toBeVisible();
  await expect(page.getByText(/Versiunea documentelor nu se schimbă/u)).toBeVisible();

  // The IDNO's rule is the shared one: a wrong check digit is refused at the field, before the round trip.
  const idno = page.getByLabel('IDNO');
  const inForce = await idno.inputValue();
  await idno.fill('1099600012346');
  await idno.blur();
  await expect(idno).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/cifra de control, nu corespunde/u)).toHaveCount(1);
  await idno.fill(inForce);

  await page.getByLabel('Denumirea înregistrată').fill(REGISTERED_NAME);
  await page.getByRole('button', { name: 'Salvați datele' }).click();
  await expect(page.getByText('Datele operatorului au fost salvate', { exact: true })).toBeVisible();
  // The attribution names the operator who saved, beside the time.
  await expect(page.getByText(`${OPERATOR},`)).toBeVisible();

  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);

  // A-21's exit: the effect is visible on S-30, to a visitor holding no session of either realm.
  const visitor = await browser.newContext();
  const terms = await visitor.newPage();
  await terms.goto(`${STACK_ORIGIN.WEB}/legal/terms`);
  await expect(terms.getByRole('definition').filter({ hasText: REGISTERED_NAME })).toHaveCount(1);
  await visitor.close();

  // The log names the save, filtered to this run's operator — the log is append-only.
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Conturi de administrator' })
    .click();
  await page.waitForURL('**/accounts');
  const log = page.getByRole('table', { name: 'Intrările jurnalului de sistem, cele mai noi primele' });
  await expect(
    log.getByRole('row').filter({ hasText: 'A salvat datele operatorului platformei' }).filter({ hasText: OPERATOR }),
  ).toHaveCount(1);
});
