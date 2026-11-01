import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { settleAnimations } from '../web/support/animations';
import {
  restoreNotificationCategorySeed,
  restoreSlot,
  snapshotNotificationCategory,
  type SlotSnapshot,
} from '../web/support/provider-config';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-17 against the built console and the real api (task 67.10; UC-176, FR-173, UX-123).
 *
 * What only this suite can prove is that the screen walks UX-123's pattern end to end with the api's own answers: an
 * operator opens the reminder — in a dialogue over the list since task 170 — reads its words rendered with example
 * values, stops it travelling in-app, meets a
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
/** FR-164's notice (task 51.2), the category whose repeat interval the second journey edits. */
const OUTSTANDING = 'reporting.outstanding_report';
const CADENCE_OPERATOR = `${RUN_PREFIX}-cadence@easyesg.md`;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The developer's own reminder settings, put back after the suite (task 172); each case still starts from the seed. */
let reminderSlot: SlotSnapshot | undefined;
let outstandingSlot: SlotSnapshot | undefined;

test.beforeAll(async () => {
  reminderSlot = await snapshotNotificationCategory(REMINDER);
  outstandingSlot = await snapshotNotificationCategory(OUTSTANDING);
});

test.afterAll(async () => {
  if (reminderSlot !== undefined) await restoreSlot(reminderSlot);
  if (outstandingSlot !== undefined) await restoreSlot(outstandingSlot);
  await cleanupOperators(RUN_PREFIX);
});

/** UC-68 through A-01's two steps. */
async function signIn(page: Page, operator = OPERATOR): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(operator);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuați' }).click();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(TOTP_SECRET));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
  await page.waitForURL('**/organizations');
}

// A-17's record is a dialogue that fades in, and axe measures colour as painted — so every scan here waits for the
// page's animations to finish. Without it the record's muted labels read 3.48:1 through the fade (Gates run
// 39992893760, 23 Oct 2026); at rest they read 4.99:1.
const expectNoAxeViolations = async (page: Page) => {
  await settleAnimations(page);
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

  // A category code fixes says so, and offers no editor — so its row offers to view it, not to edit it (task 170).
  await page.getByRole('button', { name: 'Vedeți Resetarea parolei', exact: true }).click();
  const reset = page.getByRole('dialog', { name: 'Resetarea parolei', exact: true });
  await expect(reset.getByText(/sunt stabilite de platformă/u)).toBeVisible();
  await expect(reset.getByRole('button', { name: 'Previzualizați și publicați' })).toHaveCount(0);
  // The record is a modal dialogue over the list, so the next row is reached once it is closed.
  await reset.getByRole('button', { name: 'Închideți fișa', exact: true }).click();
  await expect(reset).toHaveCount(0);

  await page.getByRole('button', { name: 'Editați Mementouri', exact: true }).click();
  await page.waitForURL(/[?&]category=reporting\.manual_reminder/u);
  const record = page.getByRole('dialog', { name: 'Mementouri', exact: true });

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

  // The console's navigation behind the modal record is reached once it is closed.
  await record.getByRole('button', { name: 'Închideți fișa', exact: true }).click();
  await expect(record).toHaveCount(0);

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

/**
 * FR-173 AC-11 (task 51.2): a repeat interval is edited and published as configuration, with no release — the field the
 * record offers only on the category that keeps one, the disclosure naming *when* recipients will hear, and the revert
 * restoring the interval as well as the channels.
 */
test('an operator makes the outstanding-report notice repeat fortnightly past a disclosure, and reverts it', async ({ page }) => {
  await restoreNotificationCategorySeed(OUTSTANDING);
  provisionOperator({
    email: CADENCE_OPERATOR,
    password: PASSWORD,
    totpSecret: TOTP_SECRET,
    role: OPERATOR_ROLE.PLATFORM_ADMINISTRATOR,
  });
  await signIn(page, CADENCE_OPERATOR);
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Categorii de notificări' })
    .click();
  await page.waitForURL('**/notification-templates');

  await page.getByRole('button', { name: 'Editați Câmpuri de completat', exact: true }).click();
  const record = page.getByRole('dialog', { name: 'Câmpuri de completat', exact: true });
  await expect(record.getByText('La fiecare 7 zile, cât timp raportul are câmpuri de completat')).toBeVisible();
  const interval = record.getByLabel('Se repetă la fiecare (zile)');
  await expect(interval).toHaveValue('7');
  // Only the category that repeats offers the interval; it has no lead times to edit.
  await expect(record.getByLabel('Zile înainte de termen')).toHaveCount(0);
  await expectNoAxeViolations(page);

  await interval.fill('14');
  await record.getByRole('button', { name: 'Previzualizați și publicați' }).click();
  const publish = page.getByRole('alertdialog');
  await expect(publish.getByText(/notificarea se va repeta la fiecare 14 zile\./u)).toBeVisible();
  await publish.getByRole('button', { name: 'Publicați', exact: true }).click();
  await expect(record.getByText('La fiecare 14 zile, cât timp raportul are câmpuri de completat')).toBeVisible();

  await page
    .getByRole('status')
    .filter({ hasText: 'Setările sunt în vigoare' })
    .getByRole('button', { name: 'Reveniți la setările anterioare' })
    .click();
  const revert = page.getByRole('alertdialog');
  await expect(revert.getByText(/notificarea se va repeta la fiecare 7 zile\./u)).toBeVisible();
  await revert.getByRole('button', { name: 'Reveniți', exact: true }).click();
  await expect(record.getByText('La fiecare 7 zile, cât timp raportul are câmpuri de completat')).toBeVisible();
  await expect(interval).toHaveValue('7');
});
