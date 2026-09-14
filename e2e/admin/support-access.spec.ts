import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations as cleanupTenantOrganizations,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from '../web/support/db';
import { OPERATOR_ROLE, cleanupOperators, provisionOperator } from './support/provision';
import { currentTotpCode } from './support/totp';

/**
 * A-07 and UX-124's banner, as one journey across both applications (task 67.9; UC-85, UC-86; FR-78 as amended
 * 14 Sep 2026) — against the built console, the standalone tenant app and the real api.
 *
 * What only this suite can prove: that a request raised from A-02's record reaches the organization's administrator
 * **in the other application**, that granting it there opens the organization's reports here with a countdown above
 * them, that ending it there closes them here, and that the log keeps the whole story — who asked, who granted, who
 * ended it and from which side, and what was read. The api suite proves the rules; this proves the two screens that
 * carry them agree about what happened.
 *
 * **It lives in the `admin` project and drives the tenant app by absolute address**, in its own browser context so
 * the two sessions cannot share a cookie jar.
 */
const RUN_PREFIX = `e2e-support-${process.pid}-${Date.now()}`;
const WEB_ORIGIN = 'http://localhost:3100';
const OPERATOR = `${RUN_PREFIX}-pa@easyesg.md`;
const OWNER = `${RUN_PREFIX}-oa@example.md`;
const PASSWORD = 'Parola123!';
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const randomOf = (alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const TOKEN = `sa${randomOf('abcdefghijklmnopqrstuvwxyz', 10)}`;
const ORGANIZATION = `Acces e2e ${TOKEN}`;
const ENTITY = 'Brutăria Lina';
const TICKET = 'SUP-4417';
const REASON = 'Proprietarul raportează că cifra pentru Scope 2 lipsește din export după recalculare.';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOperators(RUN_PREFIX);
  await cleanupTenantOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/** UC-68 through A-01's two steps. */
async function signInOperator(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(OPERATOR);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuați' }).click();
  await page.getByLabel('Cod de verificare').fill(currentTotpCode(TOTP_SECRET));
  await page.getByRole('button', { name: 'Continuați în consolă' }).click();
  await page.waitForURL('**/organizations');
}

/** The organization's administrator, registered and verified the way a person is. */
async function registerOwner(tenant: Page): Promise<void> {
  await tenant.goto('/register');
  await tenant.getByLabel('Prenume').fill('Ana');
  await tenant.getByLabel('Nume de familie').fill('Popescu');
  await tenant.getByLabel('E-mail de serviciu').fill(OWNER);
  await tenant.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await tenant.getByRole('button', { name: 'Creați contul' }).click();
  await tenant.waitForURL('**/verify');
  const token = await verificationTokenFor(OWNER);
  await tenant.goto(`/verify?token=${token}`);
  await tenant.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(tenant.getByText('Adresa este confirmată')).toBeVisible();
}

/** Signed in, and waited for §4.3's branch to land on the one organization's home. */
async function signInOwner(tenant: Page): Promise<void> {
  await tenant.goto('/sign-in');
  await tenant.getByLabel('Adresa de e-mail').fill(OWNER);
  await tenant.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await tenant.getByRole('button', { name: 'Intrați în cont' }).click();
  await tenant.waitForURL('**/home');
}

test('a request raised from the register is granted by the organization, read under its countdown, ended from the banner, and kept in the log', async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);

  provisionOperator({
    email: OPERATOR,
    password: PASSWORD,
    totpSecret: TOTP_SECRET,
    role: OPERATOR_ROLE.PLATFORM_ADMINISTRATOR,
  });
  const tenantContext = await browser.newContext({ baseURL: WEB_ORIGIN });
  const tenant = await tenantContext.newPage();
  await registerOwner(tenant);
  const organizationId = await grantMembership({ email: OWNER, organizationName: ORGANIZATION });
  organizations.push(organizationId);
  await seedReport({ organizationId, name: ENTITY, fiscalYear: 2025 });

  // The operator asks, from the organization's record in the register.
  await signInOperator(page);
  await page.getByLabel('Căutați după nume sau IDNO').fill(TOKEN);
  await page.getByRole('button', { name: 'Căutați', exact: true }).click();
  await page.getByRole('button', { name: ORGANIZATION }).click();
  await page.getByRole('link', { name: 'Cereți acces de suport' }).click();
  await page.waitForURL(/\/support-access\?organization=/u);
  await expect(
    page.getByRole('navigation', { name: 'Secțiunile consolei' }).getByRole('link', { name: 'Acces de suport' }),
  ).toHaveAttribute('aria-current', 'page');

  const request = page.getByRole('region', { name: 'Cerere de acces de suport' });
  await expect(request).toContainText(ORGANIZATION);
  await expect(request).toContainText('60 de minute de la acceptare');
  await expect(request).toContainText('Doar citire');
  await request.getByLabel('Referința tichetului').fill(TICKET);
  // The reason is written for the organization and may run long, so it is a multi-line field (UX-89 amended).
  await expect(request.getByLabel('Motivul, pentru organizație')).toHaveJSProperty('tagName', 'TEXTAREA');
  await request.getByLabel('Motivul, pentru organizație').fill(REASON);
  await request.getByRole('button', { name: 'Trimiteți cererea organizației' }).click();
  await expect(page.getByText('Cererea a fost trimisă')).toBeVisible();

  const inProgress = page.getByRole('region', { name: 'Cereri în curs' });
  await expect(inProgress).toContainText('Așteaptă răspunsul organizației');
  // A request grants nothing: only a running grant offers its reports.
  await expect(inProgress.getByRole('button', { name: 'Citiți rapoartele' })).toHaveCount(0);

  // The organization's administrator sees it in their own application, and grants it.
  await signInOwner(tenant);
  const awaiting = tenant.getByRole('status').filter({ hasText: 'cere acces la rapoartele organizației' });
  await expect(awaiting).toContainText(OPERATOR);
  await expect(awaiting).toContainText(TICKET);
  await expect(awaiting).toContainText(REASON);
  await awaiting.getByRole('button', { name: 'Acordați acces pentru 60 de minute' }).click();
  const running = tenant.getByRole('status').filter({ hasText: 'citește acum rapoartele organizației' });
  await expect(running.getByRole('button', { name: 'Încheiați accesul acum' })).toBeVisible();

  // The operator reads the reports, under the countdown and the sentence that says it is observed.
  await page.reload();
  await expect(inProgress).toContainText('Acces activ până la');
  await expect(inProgress.getByRole('timer')).toContainText('minute rămase');
  await inProgress.getByRole('button', { name: 'Citiți rapoartele' }).click();
  await page.waitForURL(/[?&]request=/u);

  const grant = page.getByRole('region', { name: 'Rapoartele organizației, doar citire' });
  await expect(grant.getByRole('heading', { name: `Rapoartele organizației ${ORGANIZATION}` })).toBeVisible();
  await expect(grant.getByRole('timer')).toContainText('minute rămase');
  await expect(grant).toContainText('Organizația vede că accesul este activ');
  await grant.getByRole('button', { name: `${ENTITY} · anul 2025` }).click();
  await grant.getByRole('button', { name: /^B1 · / }).click();
  await expect(grant.getByRole('heading', { name: 'Valorile modulului B1' })).toBeVisible();

  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);

  // The organization ends it from its banner, and the reports close here.
  await tenant.reload();
  await running.getByRole('button', { name: 'Încheiați accesul acum' }).click();
  await expect(running).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Accesul s-a încheiat')).toBeVisible();
  await expect(grant).toHaveCount(0);

  // The log keeps the story: the grant's author, the end's side, and what was read.
  const log = page.getByRole('region', { name: 'Jurnalul accesului de suport' });
  const row = log.getByRole('row').filter({ hasText: ORGANIZATION });
  await expect(row).toContainText('Încheiat');
  await expect(row).toContainText(`Acceptată de ${OWNER}`);
  await row.getByRole('button').click();

  const record = page.getByRole('complementary', { name: 'Fișa cererii' });
  await expect(record).toContainText(REASON);
  await expect(record).toContainText(`${OWNER}, din partea organizației`);
  await expect(record).toContainText('Lista rapoartelor');
  await expect(record).toContainText('Modulele unui raport');
  await expect(record).toContainText('Valorile unui modul · modulul B1');

  await tenantContext.close();
});
