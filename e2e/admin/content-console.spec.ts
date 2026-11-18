import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../support/test';
import { settleAnimations } from '../web/support/animations';
import { cleanupContent } from './support/content';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-03 through the built console, cross-origin (task 67.5; UC-71, UC-72; FR-62): a Platform Administrator writes a new
 * help topic in Romanian and English, sends it to review, previews the set, signs off both languages and publishes it —
 * the item is then in force, and A-08's log says so. Axe runs on the editor and on the publication dialogue.
 */
const RUN_PREFIX = `e2e-content-${process.pid}-${Date.now()}`;
const KEY = `e2e-${process.pid}-${Date.now()}-tema`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test.afterAll(async () => {
  await cleanupContent(`e2e-${process.pid}-`);
  await cleanupOperators(RUN_PREFIX);
});

async function signIn(page: Page, email: string) {
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuați' }).click();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(TOTP_SECRET));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
}

const expectNoAxeViolations = async (page: Page) => {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

test('a new help topic is drafted in two languages, reviewed, signed off and published, and the log says so', async ({
  page,
}) => {
  const email = `${RUN_PREFIX}-pa@easyesg.md`;
  provisionOperator({ email, password: PASSWORD, totpSecret: TOTP_SECRET, role: OPERATOR_ROLE.PLATFORM_ADMINISTRATOR });

  await page.goto('/sign-in');
  await signIn(page, email);
  await page.waitForURL('**/organizations');
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Conținut și traduceri' })
    .click();
  await page.waitForURL('**/content');
  await expect(page.getByRole('heading', { level: 1, name: 'Conținut și traduceri' })).toBeVisible();

  await page.getByRole('button', { name: 'Temă de ajutor nou' }).click();
  const editor = page.getByRole('dialog', { name: 'Temă de ajutor nou' });
  await editor.getByLabel('Cheia elementului').fill(KEY);
  await editor.getByLabel('Titlul').fill('Temă de probă');
  await editor.getByLabel('Rezumatul').fill('Un rezumat în română.');
  await editor.getByRole('radio', { name: /Engleză/u }).check();
  await editor.getByLabel('Titlul').fill('Trial topic');
  await editor.getByLabel('Rezumatul').fill('A summary in English.');
  await editor.getByRole('button', { name: 'Salvați ciorna' }).click();

  // The first save gives the item its address; the editor stays open on it.
  await page.waitForURL(new RegExp(`item=help_topic%2F${KEY}`, 'u'));
  const item = page.getByRole('dialog', { name: 'Temă de probă' });
  await expect(item.getByRole('status')).toContainText('Ciorna a fost salvată.');
  await expectNoAxeViolations(page);
  await item.getByRole('button', { name: 'Trimiteți spre revizuire' }).click();
  await expect(item.getByRole('status')).toContainText('trimisă spre revizuire');
  await item.getByRole('button', { name: 'Închideți', exact: true }).first().click();

  await page.getByRole('button', { name: 'Publicați setul revizuit' }).click();
  const publication = page.getByRole('dialog', { name: 'Publicați un set revizuit' });
  await publication.getByRole('checkbox', { name: 'Temă de probă' }).check();
  await publication.getByRole('button', { name: 'Previzualizați' }).click();
  await expect(publication).toContainText('Conținutul niciunui raport nu se schimbă.');
  const publish = publication.getByRole('button', { name: 'Publicați elementul' });
  await expect(publish).toBeDisabled();
  await publication.getByRole('checkbox', { name: 'Am revizuit textul în Română' }).check();
  await publication.getByRole('checkbox', { name: 'Am revizuit textul în Engleză' }).check();
  await expectNoAxeViolations(page);
  await publish.click();

  await expect(page.getByRole('status').filter({ hasText: 'Setul a fost publicat.' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: KEY });
  await expect(row).toContainText('Versiunea');
  await expect(row).toContainText('Română, Engleză');

  await page.goto('/accounts');
  await expect(
    page.getByRole('row').filter({ hasText: 'A publicat un set revizuit de conținut' }).filter({ hasText: email }),
  ).toHaveCount(1);
});
