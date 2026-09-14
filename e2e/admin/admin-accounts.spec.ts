import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cleanupInvitationEmails, invitationTokenFor } from './support/invitations';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-08 and A-20 through the built console, cross-origin (task 67.4): a Platform Administrator invites
 * an operator; the operator, in a browser holding no session, sets a password, enrols the second factor
 * from what the screen prints and signs in; the administrator suspends the account and reads the change
 * in the log. Axe runs on both screens in their busiest states.
 */
const RUN_PREFIX = `e2e-accounts-${process.pid}-${Date.now()}`;
const emailFor = (label: string) => `${RUN_PREFIX}-${label}@easyesg.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const literally = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u');

test.afterAll(async () => {
  await cleanupInvitationEmails(RUN_PREFIX);
  await cleanupOperators(RUN_PREFIX);
});

async function signIn(page: Page, input: { readonly email: string; readonly secret: string }) {
  await page.getByLabel('Adresa de e-mail').fill(input.email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuați' }).click();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(input.secret));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
}

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations).toEqual([]);
};

test('an invited operator sets their own credentials and signs in, and suspending them is in the log', async ({
  page,
  browser,
}) => {
  const administrator = emailFor('pa');
  provisionOperator({
    email: administrator,
    password: PASSWORD,
    totpSecret: TOTP_SECRET,
    role: OPERATOR_ROLE.PLATFORM_ADMINISTRATOR,
  });

  await page.goto('/sign-in');
  await signIn(page, { email: administrator, secret: TOTP_SECRET });
  await page.waitForURL('**/organizations');

  // A-08 is the platform section's second destination (task 67.4's nav entry).
  await page
    .getByRole('navigation', { name: 'Secțiunile consolei' })
    .getByRole('link', { name: 'Conturi de administrator' })
    .click();
  await page.waitForURL('**/accounts');
  await expect(page.getByRole('heading', { level: 1, name: 'Conturi de administrator' })).toBeVisible();

  const invitee = emailFor('invitee');
  await page.getByRole('button', { name: 'Invitați un administrator' }).click();
  await page.waitForURL(/[?&]panel=invite/u);
  const form = page.getByRole('complementary', { name: 'Invitați un administrator' });
  await form.getByLabel('Adresa de e-mail').fill(invitee);
  await form.getByRole('combobox', { name: 'Domeniul contului' }).click();
  await page.getByRole('option', { name: 'Operator de facturare' }).click();
  await form.getByRole('button', { name: 'Trimiteți invitația' }).click();
  await expect(page.getByText('Invitația a fost trimisă')).toBeVisible();

  const roster = page.getByRole('table', { name: 'Conturile operatorilor și invitațiile în curs' });
  const inviteeRow = roster.getByRole('row', { name: literally(invitee) });
  await expect(inviteeRow).toHaveCount(1);
  await expect(inviteeRow).toContainText('Invitat');

  // The invitee, in a browser that has never held a console session.
  const token = await invitationTokenFor(invitee);
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/invitation/${token}`);

  await expect(
    guest.getByRole('heading', { level: 1, name: 'Alegeți parola contului de operator' }),
  ).toBeVisible();
  await expect(guest.getByText(invitee)).toBeVisible();
  await guest.getByLabel('Parolă nouă', { exact: true }).fill(PASSWORD);
  await guest.getByRole('button', { name: 'Continuați' }).click();

  await expect(guest.getByRole('heading', { level: 1, name: 'Configurați al doilea factor' })).toBeVisible();
  // The printed key, which is what a desktop authenticator takes — the same secret the symbol encodes.
  const secret = ((await guest.locator('p[translate="no"]').textContent()) ?? '').trim();
  expect(secret).toMatch(/^[A-Z2-7]+=*$/u);
  await expectNoAxeViolations(guest);

  await guest.getByLabel('Cod de verificare').fill(currentTotpCode(secret));
  await guest.getByRole('button', { name: 'Creați contul' }).click();
  await guest.waitForURL(/\/sign-in\?.*notice=invitation-accepted/u);
  await expect(guest.getByText('Contul de operator a fost creat')).toBeVisible();

  // The account exists, with exactly the credentials just chosen.
  await signIn(guest, { email: invitee, secret });
  await guest.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
  await guestContext.close();

  await page.reload();
  await expect(inviteeRow).toContainText('Activ');
  await inviteeRow.getByRole('button', { name: invitee }).click();
  await page.waitForURL(/[?&]selected=/u);

  const record = page.getByRole('complementary', { name: 'Fișa contului' });
  await expect(record).toContainText('Operator de facturare');
  await expectNoAxeViolations(page);

  await record.getByRole('button', { name: 'Suspendați contul' }).click();
  const dialogue = page.getByRole('alertdialog');
  await expect(dialogue).toContainText(invitee);
  await dialogue.getByRole('button', { name: 'Suspendați contul' }).click();

  await expect(page.getByText(`Contul ${invitee} a fost suspendat`, { exact: false })).toBeVisible();
  await expect(inviteeRow).toContainText('Suspendat');

  const log = page.getByRole('table', { name: 'Intrările jurnalului de sistem, cele mai noi primele' });
  await expect(
    log.getByRole('row', { name: new RegExp(`A suspendat un cont.*${literally(invitee).source}`, 'u') }),
  ).toHaveCount(1);
});

test('a Billing Operator who follows the accounts address is told who manages them', async ({ page }) => {
  const operator = emailFor('bo');
  provisionOperator({
    email: operator,
    password: PASSWORD,
    totpSecret: TOTP_SECRET,
    role: OPERATOR_ROLE.BILLING_OPERATOR,
  });

  await page.goto('/accounts');
  await page.waitForURL('**/sign-in?*redirect=*');
  await signIn(page, { email: operator, secret: TOTP_SECRET });

  await page.waitForURL('**/accounts');
  await expect(
    page.getByText('Conturile de administrator sunt gestionate de administratorii de platformă'),
  ).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});
