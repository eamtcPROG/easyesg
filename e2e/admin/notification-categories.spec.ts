import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { restoreNotificationCategorySeed } from '../web/support/provider-config';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-17 against the built console and the real api (task 67.10; UC-176, FR-173, UX-123).
 *
 * What only this suite can prove is that the screen walks UX-123's pattern end to end with the api's own answers: an
 * operator opens the reminder, reads its words rendered with example values, stops it travelling in-app, meets a
 * disclosure that names the channel removed, publishes, reverts from the result in one step past a second
 * disclosure, and finds both in A-08's log named by the category. **The rules are the api suite's**
 * (`apps/api/test/admin-notification-categories.e2e-spec.ts`); this proves the two halves agree about what happened.
 *
 * **It ends where it began** — the revert republishes the seed's behaviour — and the seed is republished afterwards
 * anyway, so a failure part-way leaves the reminder as every later suite expects it.
 */
const RUN_PREFIX = `e2e-categories-${process.pid}-${Date.now()}`;
const OPERATOR = `${RUN_PREFIX}-pa@easyesg.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const REMINDER = 'reporting.manual_reminder';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.afterAll(async () => {
  await restoreNotificationCategorySeed(REMINDER);
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

test('an operator stops the reminder travelling in-app past a disclosure, and reverts it in one step', async ({ page }) => {
  await restoreNotificationCategorySeed(REMINDER);
  provisionOperator({
    email: OPERATOR,
    password: PASSWORD,
    totpSecret: TOTP_SECRET,
    role: OPERATOR_ROLE.PLATFORM_ADMINISTRATOR,
  });
  await signIn(page);

  // A-17 is the platform section's fifth destination (task 67.10's nav entry).
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Categorii de notificări' })
    .click();
  await page.waitForURL('**/notification-templates');
  await expect(page.getByRole('heading', { level: 1, name: 'Categorii de notificări' })).toBeVisible();

  // A category code fixes says so, and offers no editor.
  await page.getByRole('button', { name: 'Resetarea parolei', exact: true }).click();
  const reset = page.getByRole('complementary', { name: 'Fișa categoriei Resetarea parolei' });
  await expect(reset.getByText(/sunt stabilite de platformă/u)).toBeVisible();
  await expect(reset.getByRole('button', { name: 'Previzualizați și publicați' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Mementouri', exact: true }).click();
  await page.waitForURL(/[?&]category=reporting\.manual_reminder/u);
  const record = page.getByRole('complementary', { name: 'Fișa categoriei Mementouri' });

  // The words a recipient reads, rendered with example values rather than placeholders.
  // Twice, exactly: the email's subject and the in-app title are the same sentence.
  const romanian = record.getByRole('region', { name: 'Română' });
  await expect(romanian.getByText('Ana Rusu vă reamintește de raportul Brutăria Lina SRL pentru 2026')).toHaveCount(2);
  await expect(record.getByText(/\{senderName\}/u)).toHaveCount(0);

  // UX-123: preview → scope disclosure → confirm.
  await record.getByRole('checkbox', { name: 'În aplicație' }).uncheck();
  await record.getByRole('button', { name: 'Previzualizați și publicați' }).click();
  const publish = page.getByRole('alertdialog');
  await expect(publish.getByRole('heading', { name: 'Publicați setările categoriei Mementouri?' })).toBeVisible();
  await expect(publish.getByText(/Nu se mai trimite în aplicație\./u)).toBeVisible();
  await expectNoAxeViolations(page);
  await publish.getByRole('button', { name: 'Publicați', exact: true }).click();

  // → result, with the one-step revert.
  await expect(page.getByText('Setările categoriei Mementouri au fost publicate și au efect în câteva secunde.')).toBeVisible();
  await expect(record.getByRole('checkbox', { name: 'În aplicație' })).not.toBeChecked();

  // From the result itself — the record offers the same revert, and the notice is UX-123's last step.
  await page
    .getByRole('status')
    .filter({ hasText: 'Setările sunt în vigoare' })
    .getByRole('button', { name: 'Reveniți la setările anterioare' })
    .click();
  const revert = page.getByRole('alertdialog');
  await expect(revert.getByRole('heading', { name: 'Reveniți la setările anterioare ale categoriei Mementouri?' })).toBeVisible();
  await expect(revert.getByText(/Se trimite și în aplicație/u)).toBeVisible();
  await revert.getByRole('button', { name: 'Reveniți', exact: true }).click();
  await expect(page.getByText('Categoria Mementouri are din nou setările anterioare, în vigoare în câteva secunde.')).toBeVisible();
  await expect(record.getByRole('checkbox', { name: 'În aplicație' })).toBeChecked();

  // A-08 names both writes by the category, filtered to this run's operator: the log is append-only.
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Conturi de administrator' })
    .click();
  await page.waitForURL('**/accounts');
  const log = page.getByRole('table', { name: 'Intrările jurnalului de sistem, cele mai noi primele' });
  const mine = log.getByRole('row').filter({ hasText: OPERATOR });
  await expect(mine.filter({ hasText: 'A publicat setările unei categorii de notificări' })).toContainText('Mementouri');
  await expect(mine.filter({ hasText: 'A readus setările anterioare ale unei categorii de notificări' })).toContainText(
    'Mementouri',
  );
});
