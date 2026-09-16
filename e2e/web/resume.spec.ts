import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  disclosureValueOf,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';
import { enrolFactor } from './support/second-factor';

/**
 * Resuming a draft (task 35.3; UC-36, FR-39, UX-39) — the pattern's other half, and the half a
 * reload actually exercises: **a draft survives reload and a second device**, and the reporter is
 * put back where work stopped.
 *
 * "A second device" is a second browser context: no cookies, no IndexedDB, nothing shared with the
 * first but the account. What it sees is what the server holds, which is the whole claim.
 *
 * The rest are UX-38's (task 92; UC-07). A change queued when the session is gone is submitted once the
 * reporter confirms it is them **over the step, which is never left** — the journey task 35.3 wrote
 * through the `?return=` redirect, its redirect assertion inverted. Then what that journey could not
 * reach: a second factor answered inside the dialogue, a step change that finds the session gone, and the
 * dialogue's other way out, which is 35.3's return path still.
 *
 * A session ends here the way it ends underneath an open tab: the cookies go and the page stays.
 *
 * **The writing journeys work in B3, and the reason was measured.** B1 commits a default on arrival
 * (FR-27; `autosave.spec.ts`), and that write, sent after hydration, lands just behind the cleared
 * cookies: its trace shows one `PUT …/values` answered `401` before the reporter's own blur, the dialogue
 * opening on it, and Radix's modal hiding the field from the accessibility tree before the Tab. That is
 * the product doing the right thing — a refused write opens the dialogue whoever made it — and a journey
 * about *this reporter's* change cannot stand on it. B3 commits nothing on arrival, so the dialogue's
 * *one change is waiting* can only be the reporter's, and a step that later gains an arrival default
 * turns that sentence into two and fails here rather than passing on the wrong write.
 */
const RUN_PREFIX = `e2e-web-resume-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

/** B3's first numeric — the catalogue's own Romanian label, matched exactly. */
const B3_ENERGY = { elementKey: 'TotalEnergyConsumption', label: 'Consumul total de energie' };

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function registered(page: Page, label: string): Promise<{ email: string; reportId: string; organizationId: string }> {
  const email = addressFor(label);
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();

  const organizationId = await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}` });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity` });
  return { email, reportId, organizationId };
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

const input = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true });

/** The re-authentication dialogue, by its title — the catalogue's Romanian, matched exactly. */
const dialogueOf = (page: Page) =>
  page.getByRole('dialog', { name: 'Confirmați că sunteți dumneavoastră ca să continuați', exact: true });

const CONTINUE = 'Continuați de unde ați rămas';

/** The explanation's count when exactly the reporter's one change is waiting. */
const ONE_CHANGE_WAITING = 'o modificare așteaptă pe acest dispozitiv';

/**
 * Every address the page's own frame is at from now on, pushed history included — so a journey can say
 * the sign-in screen was never on the way, rather than only that the page ended somewhere acceptable.
 */
function addressesFrom(page: Page): readonly string[] {
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });
  return visited;
}

/** The dialogue's first stage: the password, for the account the step was rendered for. */
async function confirmPassword(page: Page): Promise<void> {
  const dialogue = dialogueOf(page);
  // `^Parola`: at this width the label also names the account (the artboard's 1440 frame).
  await dialogue.getByLabel(/^Parola/u).fill(PASSWORD);
  await dialogue.getByRole('button', { name: CONTINUE, exact: true }).click();
}

const answer = async (page: Page, target: { readonly label: string; readonly value: string }) => {
  const field = input(page, target.label);
  await field.fill(target.value);
  await field.press('Tab');
};

/**
 * A second device: a fresh context sharing nothing with the first but the account. A context
 * created from the `browser` fixture inherits none of the project's `use` — no `baseURL`, no
 * locale — so the project's options are passed through explicitly.
 */
async function secondDevice(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext(test.info().project.use);
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

test('a draft answered on one device is what a second device sees, at the step where work stopped (FR-39, UX-39)', async ({
  page,
  browser,
}) => {
  const { email, reportId, organizationId } = await registered(page, 'device');
  await signIn(page, email);

  // Work in B3 while B1 is still incomplete — the case that tells "where work stopped" apart from
  // "first incomplete" (UX-10), which is what the entry route answered before this task.
  await page.goto(`/reports/${reportId}/B3`);
  await answer(page, { label: B3_ENERGY.label, value: '1240' });
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: B3_ENERGY.elementKey }))
    .toMatchObject({ valueNumeric: '1240' });

  const other = await secondDevice(browser, email);
  await other.goto(`/reports/${reportId}`);
  // Position: B3, not B1.
  await other.waitForURL(`**/reports/${reportId}/B3`);
  // Values: the server's, with nothing carried over from the first device.
  await expect(input(other, B3_ENERGY.label)).toHaveValue('1240');
  await other.context().close();
});

test('opening a report nobody has answered still lands on the first incomplete step (UX-10)', async ({
  page,
}) => {
  const { email, reportId } = await registered(page, 'fresh');
  await signIn(page, email);
  await page.goto(`/reports/${reportId}`);
  await page.waitForURL(`**/reports/${reportId}/B1`);
});

test('a change queued while the session is gone is submitted after confirming it is you, over the step (UX-38, UC-07)', async ({
  page,
  context,
}) => {
  const { email, reportId, organizationId } = await registered(page, 'expiry');
  await signIn(page, email);
  await page.goto(`/reports/${reportId}/B3`);
  const visited = addressesFrom(page);

  // The session ends underneath the open wizard — the sealed cookie is gone, the page is not.
  await context.clearCookies();
  await answer(page, { label: B3_ENERGY.label, value: '12' });

  // The flush is refused for want of a session, and the step is not left: the dialogue opens over it,
  // naming the step and saying that exactly this one change is waiting on this device.
  const dialogue = dialogueOf(page);
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText('secțiunea B3');
  await expect(dialogue).toContainText(ONE_CHANGE_WAITING);
  expect(await disclosureValueOf({ organizationId, reportId, elementKey: B3_ENERGY.elementKey })).toBeNull();

  await confirmPassword(page);
  await expect(dialogue).toBeHidden();

  // The queue drains: the change made without a session is now the server's.
  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: B3_ENERGY.elementKey }))
    .toMatchObject({ valueNumeric: '12' });
  await expect(input(page, B3_ENERGY.label)).toHaveValue('12');

  // **Task 35.3's redirect assertion, inverted**: the reader never left the step for a sign-in screen.
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}/B3$`, 'u'));
  expect(visited.filter((address) => address.includes('/sign-in'))).toEqual([]);
});

test('an account with a second factor answers it inside the dialogue, a recovery code as readily as the app (UC-194, UC-195)', async ({
  page,
  context,
}) => {
  const { email, reportId, organizationId } = await registered(page, 'factor');
  await signIn(page, email);
  // Through S-28's own controls, as every factor journey enrols (`support/second-factor.ts` says why).
  const { recovery } = await enrolFactor(page, { email, password: PASSWORD });
  const [recoveryCode] = recovery;
  if (recoveryCode === undefined) throw new Error('enrolment showed no recovery codes');

  await page.goto(`/reports/${reportId}/B3`);
  await context.clearCookies();
  await answer(page, { label: B3_ENERGY.label, value: '7' });

  const dialogue = dialogueOf(page);
  await expect(dialogue).toContainText(ONE_CHANGE_WAITING);
  await confirmPassword(page);
  // The password was right: the code is asked for in the same dialogue, over the same step.
  await expect(dialogue.getByLabel('Codul din aplicația de autentificare')).toBeVisible();
  await dialogue.getByRole('button', { name: /Folosiți un cod de recuperare/u }).click();
  await dialogue.getByLabel('Cod de recuperare').fill(recoveryCode);
  await dialogue.getByRole('button', { name: CONTINUE, exact: true }).click();
  await expect(dialogue).toBeHidden();

  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: B3_ENERGY.elementKey }))
    .toMatchObject({ valueNumeric: '7' });
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}/B3$`, 'u'));
});

test('a step change that finds the session gone opens the dialogue instead of leaving the step (UX-38)', async ({
  page,
  context,
}) => {
  const { email, reportId } = await registered(page, 'navigation');
  await signIn(page, email);
  // B3, where nothing is committed on arrival: this journey is about a navigation, not a write.
  await page.goto(`/reports/${reportId}/B3`);
  const rail = page.getByRole('navigation', { name: 'Secțiunile raportului', exact: true });

  await context.clearCookies();
  await rail.getByRole('link', { name: /^B1\b/u }).click();

  const dialogue = dialogueOf(page);
  await expect(dialogue).toBeVisible();
  // Nothing was waiting, and the dialogue says so in the words for that case.
  await expect(dialogue).toContainText('Nimic nu s-a pierdut — tot ce ați completat este salvat.');
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}/B3$`, 'u'));

  await confirmPassword(page);
  await expect(dialogue).toBeHidden();
  // Resuming stays on the step the reader was on (§12.5.6's task-92 row): the step change is asked for
  // again, and this time it goes.
  await expect(page).toHaveURL(new RegExp(`/reports/${reportId}/B3$`, 'u'));
  await rail.getByRole('link', { name: /^B1\b/u }).click();
  await page.waitForURL(`**/reports/${reportId}/B1`);
});

test('signing out from the dialogue returns to the step on signing in again, where the queue drains (task 35.3)', async ({
  page,
  context,
}) => {
  const { email, reportId, organizationId } = await registered(page, 'later');
  await signIn(page, email);
  await page.goto(`/reports/${reportId}/B3`);

  await context.clearCookies();
  await answer(page, { label: B3_ENERGY.label, value: '12' });
  const dialogue = dialogueOf(page);
  await expect(dialogue).toContainText(ONE_CHANGE_WAITING);
  await dialogue.getByRole('button', { name: 'Ieșiți din cont și continuați mai târziu', exact: true }).click();

  // The artboard's second way out is 35.3's return path: S-01, and back to this step after.
  await page.waitForURL(/\/sign-in\?return=/u);
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL(`**/reports/${reportId}/B3`);

  await expect
    .poll(() => disclosureValueOf({ organizationId, reportId, elementKey: B3_ENERGY.elementKey }))
    .toMatchObject({ valueNumeric: '12' });
});
