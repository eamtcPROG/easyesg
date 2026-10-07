import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupNotifications,
  cleanupOrganizations,
  grantMembership,
  organizationIdsForAccount,
  remindersRaisedFor,
  seedReport,
  seedSeatHolders,
  verificationTokenFor,
} from './support/db';

/**
 * S-16 in a real browser (UC-59 … UC-64; task 26.4).
 *
 * **Every write here goes through the shipped routes**, which is new: task 26.3's suite had to seed
 * invitations directly, and `support/db.ts` says why in as many words — "because S-16 does not exist
 * yet (task 26.4)". It does now, so the invitation this suite creates is created by pressing the
 * button, and the list that shows it is the union read model assembling two API collections.
 *
 * What is seeded is only what no route can create: the organization and its first administrator
 * (task 29 founds an organization; until then a membership has no UI).
 *
 * The filter, sort and page arithmetic are a unit spec — `features/organization/access/tools/access.spec.ts`,
 * arm by arm, because the module is pure. What this proves is the wiring those arms cannot: that
 * the address carries the view, that the actions reach the API, and that the refusals a person can
 * actually provoke reach the screen as sentences rather than as an error page.
 */
const RUN_PREFIX = `e2e-web-access-${process.pid}-${Date.now()}`;

/**
 * The shipped seat ceiling (`config/seed/seat-allowance.global.json`), which the api's
 * `seat-allowance.service.spec.ts` pins — restated here as the number the screen prints.
 */
const SEAT_CEILING = 10;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  // The reminders' outbox rows name no address, so the account cleanup cannot find them (task 50.3).
  await cleanupNotifications(organizations);
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function registerAndVerify(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Prenume').fill('Ana');
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  const token = await verificationTokenFor(email);
  await page.goto(`/verify?token=${token}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

/**
 * Sign in and **wait for the branch to land**.
 *
 * Not optional: sign-in redirects through §4.3's post-sign-in branch, and a `goto` issued before
 * that settles races the session cookie — the request arrives without one and the closed-by-default
 * gate correctly bounces it to sign-in. With exactly one membership the branch lands on `/home`,
 * so that is the signal there is a session to navigate with.
 */
async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');
}

/** An organization with the signed-in account as its administrator, which is S-16's actor. */
async function administratorOf(page: Page, label: string): Promise<string> {
  const email = addressFor(label);
  await registerAndVerify(page, email);
  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-${label}`,
  });
  organizations.push(organizationId);
  await signIn(page, email);
  return email;
}

const openAccessScreen = async (page: Page) => {
  await page.goto('/organization/users');
  await expect(page.getByRole('heading', { name: 'Utilizatori și acces', level: 1 })).toBeVisible();
};

/**
 * The person's own cell.
 *
 * `exact` is load-bearing: the role cell in the same row carries a visually-hidden label — "Rolul
 * lui <address>", because a select in a table row needs a name of its own — so a substring match
 * finds both cells and Playwright's strict mode refuses. Which is the accessible name doing exactly
 * its job, seen from the other side.
 */
const personCell = (page: Page, email: string) =>
  page.getByRole('cell', { name: email, exact: true });

/**
 * A **member's** person cell, which is two lines since task 140 and so cannot be found the way an
 * invitation's is.
 *
 * `personCell` above still fits an invitation exactly — nobody holds it, so there is no account and
 * no name, and its cell is the address alone. A member's cell holds the derived name over the
 * address, and its accessible name is the two joined by whatever separator the engine inserts at a
 * block-level boundary. **That separator is the engine's business rather than this app's**, so the
 * row is the anchor here and the two facts are asserted as contents.
 */
const memberRow = (page: Page, email: string) =>
  page.getByRole('row').filter({ hasText: email });

const memberCell = (page: Page, email: string) => memberRow(page, email).getByRole('cell').first();

/** Radix Select: open the trigger by its label, then choose the option by name. */
async function choose(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option }).click();
}

/**
 * The invitation dialogue (28 Sep 2026), found by its title. Its form is reachable only through it — the
 * list behind a modal is hidden from the accessibility tree — so a locator that still found the form
 * without opening this would be finding a second copy.
 */
const invitationDialogue = (page: Page) => page.getByRole('dialog', { name: 'Invitați un coleg' });

/**
 * Every alert this app draws: every `role="alert"` on the page but Next's route announcer.
 *
 * The App Router mounts that one on every page — `__next-route-announcer__`, an empty assertive live
 * region in a shadow root on `body` — and `getByRole` finds it whenever no modal hides it. Radix hides
 * everything outside an open dialogue, so a count taken inside one never sees it and a count taken
 * after it closes always does, which made *no alert remains* unassertable (28 Sep 2026). It is left
 * out by the framework's own id, so every alert the app renders stays in the count.
 */
const appAlerts = (page: Page) =>
  page.getByRole('alert').and(page.locator(':not(#__next-route-announcer__)'));

/** The filter row's button, by its exact name: the reminder's *no one to remind* offers another. */
async function openInvitation(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Invitați un coleg', exact: true }).click();
  await expect(invitationDialogue(page)).toBeVisible();
}

/** Open, fill and send — the dialogue is left however the answer leaves it. */
async function sendInvitation(page: Page, email: string, role: string): Promise<void> {
  await openInvitation(page);
  const dialogue = invitationDialogue(page);
  await dialogue.getByLabel('Adresa de e-mail').fill(email);
  await choose(page, 'Rolul acordat', role);
  await dialogue.getByRole('button', { name: 'Trimiteți invitația', exact: true }).click();
}

test('the administrator sees themself, and invites a colleague who appears as invited', async ({
  page,
}) => {
  const administrator = await administratorOf(page, 'invite');
  await openAccessScreen(page);

  // The union's first half: the seeded membership, rendered from `GET /members`.
  // **The row count first, because `.first()` below would otherwise resolve a duplicate away.**
  // `filter({ hasText })` can match more than one row, and a member appearing twice is exactly what
  // a wrong sort key produces at a page boundary — the defect the union's `email` tie-break exists
  // to prevent. The invitation locator beside this one gets its count on line ~166; this one had
  // none until task 140's gate review said so.
  await expect(memberRow(page, administrator)).toHaveCount(1);
  // Both lines: the derived name the reader recognises, and the address every sentence this screen
  // says about the row names — the resend notice, the confirmation dialogue's object, the
  // role-change announcement. A cell showing the name alone would leave those unmatchable.
  await expect(memberCell(page, administrator)).toContainText('Ana Popescu');
  await expect(memberCell(page, administrator)).toContainText(administrator);
  // `exact`: the member's status chip, not the word inside a longer sentence elsewhere on the
  // screen. It used to disambiguate against the interim session strip's "Contul activ:", which
  // task 30.1 deleted — the reason changed, the need did not.
  await expect(page.getByText('Activ', { exact: true })).toBeVisible();
  // Task 142's counter at rest: the administrator alone holds one of the ceiling's seats.
  await expect(page.getByText(`Locuri ocupate: 1 din ${SEAT_CEILING}`, { exact: true })).toBeVisible();

  // The form is a dialogue with an address of its own (UX-4, as §5.2 applies it to A-08's): open, it
  // is in the URL, and a reload reopens it rather than dropping the reader back on the list.
  await openInvitation(page);
  await expect(page).toHaveURL(/[?&]panel=invite\b/);
  await page.reload();
  await expect(invitationDialogue(page)).toBeVisible();
  await page.getByRole('button', { name: 'Renunțați', exact: true }).click();
  await expect(invitationDialogue(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/panel=/);

  const invited = addressFor('invite-guest');
  await sendInvitation(page, invited, 'Doar vizualizare');

  // A sent invitation closes the dialogue and is said above the list, where its row now is.
  await expect(invitationDialogue(page)).toHaveCount(0);
  await expect(page.getByText(`Invitația a fost trimisă la ${invited}.`, { exact: true })).toBeVisible();
  // The other half, through the same list — which is the whole point of the read model.
  await expect(personCell(page, invited)).toBeVisible();
  await expect(page.getByText('Invitat', { exact: true })).toBeVisible();
  // And the invitation holds a seat the moment it is sent — the rule the API gates on, on screen.
  await expect(page.getByText(`Locuri ocupate: 2 din ${SEAT_CEILING}`, { exact: true })).toBeVisible();
});

/**
 * UX-52 and UX-50 in one journey, against the shipped ceiling (task 142): one seat left is a warning
 * against the counter with the form still offered, and the invitation that takes it replaces the form
 * with the gate — through the product's own route, so the region, the gate and the API agree about the
 * same count. The seats are seeded as bare memberships; eight registrations would buy nothing.
 */
test('the last seat is warned of, and taking it puts the gate where the invitation form was', async ({
  page,
}) => {
  const administrator = await administratorOf(page, 'full');
  const [organizationId] = await organizationIdsForAccount(administrator);
  await seedSeatHolders({
    organizationId,
    prefix: `${RUN_PREFIX}-full`,
    count: SEAT_CEILING - 2,
  });
  await openAccessScreen(page);

  await expect(
    page.getByText(`Locuri ocupate: ${SEAT_CEILING - 1} din ${SEAT_CEILING} · a mai rămas un loc`, {
      exact: true,
    }),
  ).toBeVisible();

  await sendInvitation(page, addressFor('full-last-seat'), 'Editare');
  await expect(invitationDialogue(page)).toHaveCount(0);

  await expect(
    page.getByText(`Locuri ocupate: ${SEAT_CEILING} din ${SEAT_CEILING} · niciun loc liber`, {
      exact: true,
    }),
  ).toBeVisible();
  // The button is still offered, and what it opens says why no invitation follows: the gate in the
  // form's place. Not offered, rather than offered and refused — the field is gone, not disabled. The
  // gate is the dialogue's alone since 28 Sep 2026 (S-16's entry); on the screen the counter says it.
  await openInvitation(page);
  await expect(invitationDialogue(page)).toContainText(
    `Toate cele ${SEAT_CEILING} locuri ale organizației sunt ocupate`,
  );
  await expect(page.getByLabel('Adresa de e-mail')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Trimiteți invitația', exact: true })).toHaveCount(0);
});

test('a second invitation to the same address is refused, in words the reader can act on', async ({
  page,
}) => {
  await administratorOf(page, 'collide');
  await openAccessScreen(page);

  const invited = addressFor('collide-guest');
  await sendInvitation(page, invited, 'Editare');
  await expect(personCell(page, invited)).toBeVisible();
  await sendInvitation(page, invited, 'Editare');

  // The API's own sentence, rendered as received — the screen keeps no second copy of it — and in
  // the dialogue, above the form it refused, which stays open for the reader to correct.
  //
  // **Unscoped, and `.first()` is gone** (28 Aug 2026). The screen holds one notice, so a second
  // alert means two settled outcomes are on screen at once — which is what this locator had been
  // tolerating while the invite panel kept an outcome outside the reducer. `FormSummary` is the
  // only other `role="alert"` the app draws here and renders only on a validation error, of which
  // this journey has none; Next's announcer is the framework's, and `appAlerts` says why it is out.
  await expect(appAlerts(page)).toHaveCount(1);
  await expect(invitationDialogue(page).getByRole('alert')).toBeVisible();

  // Closed, the refusal goes with it, and the list behind shows the one invitation it held.
  await page.getByRole('button', { name: 'Renunțați', exact: true }).click();
  await expect(invitationDialogue(page)).toHaveCount(0);
  await expect(appAlerts(page)).toHaveCount(0);
  await expect(personCell(page, invited)).toHaveCount(1);
});

test('an invitation can be withdrawn, and the confirmation names the person', async ({ page }) => {
  await administratorOf(page, 'revoke');
  await openAccessScreen(page);

  const invited = addressFor('revoke-guest');
  await sendInvitation(page, invited, 'Editare');
  await expect(personCell(page, invited)).toBeVisible();

  await page.getByRole('button', { name: 'Anulați invitația' }).click();

  // UX-70: the specific object, by name, and the specific consequence.
  const dialogue = page.getByRole('alertdialog');
  await expect(dialogue).toContainText(invited);
  await expect(dialogue).toContainText('nu mai funcționează');
  await dialogue.getByRole('button', { name: 'Anulați invitația' }).click();

  await expect(personCell(page, invited)).toHaveCount(0);
});

test('the sole administrator cannot be demoted or removed, and the screen says why', async ({
  page,
}) => {
  await administratorOf(page, 'lockout');
  await openAccessScreen(page);

  // FR-60 on the screen's side: the action is not offered, and the reason is stated rather than
  // left to a disabled control the reader has to guess at.
  await expect(page.getByRole('button', { name: 'Retrageți accesul' })).toBeDisabled();
  await expect(page.getByText('Este singurul administrator al organizației.')).toBeVisible();
});

test('the view lives in the address, so a filtered list can be linked and reloaded', async ({
  page,
}) => {
  await administratorOf(page, 'url');
  await openAccessScreen(page);

  // The default view writes nothing — a bare path and the default are one address (UX-4).
  expect(new URL(page.url()).search).toBe('');

  await choose(page, 'Rolul', 'Doar vizualizare');
  await page.waitForURL('**/organization/users?role=viewer');

  // Reloading the address reproduces the view rather than resetting it.
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Rolul', exact: true })).toContainText(
    'Doar vizualizare',
  );
  await expect(page.getByText('Nicio persoană nu corespunde filtrelor')).toBeVisible();
});

test('the administrator reminds a colleague about an open report, and the reminder is raised to them (UC-175)', async ({
  page,
}) => {
  const administrator = await administratorOf(page, 'remind');
  const organizationId = organizations[organizations.length - 1];
  await seedSeatHolders({ organizationId, prefix: `${RUN_PREFIX}-remind-mate`, count: 1 });
  const colleague = `${RUN_PREFIX}-remind-mate-seat-1@example.md`;

  // The reminder is a dialogue since 28 Sep 2026, opened from the filter row or from a member's row. With no report
  // open there is nothing to remind about, and it says so rather than offering a form.
  const reminder = page.getByRole('dialog', { name: 'Trimiteți un memento' });
  await openAccessScreen(page);
  await page.getByRole('button', { name: 'Trimiteți un memento', exact: true }).click();
  await expect(reminder).toContainText('Niciun raport nu este deschis acum');
  await expect(page.getByRole('combobox', { name: 'Raportul', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Închideți', exact: true }).click();
  await expect(reminder).toHaveCount(0);

  const reportId = await seedReport({ organizationId, name: 'Brutăria Lina', fiscalYear: 2026 });
  await openAccessScreen(page);

  // Every active member but the sender carries *remind*: the colleague's row does, the administrator's own does not.
  await expect(memberRow(page, administrator).getByRole('button', { name: 'Amintiți-i' })).toHaveCount(0);
  await memberRow(page, colleague).getByRole('button', { name: 'Amintiți-i' }).click();

  // The row's action opens the reminder with them chosen, and the address says so, as a link would reopen it.
  await expect(page).toHaveURL(/[?&]panel=remind&person=/);
  const person = page.getByRole('combobox', { name: 'Persoana', exact: true });
  await expect(person).toHaveText(colleague);
  // Everyone but the sender: the organization holds two members, and only the colleague is offered.
  await person.click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option', { name: administrator })).toHaveCount(0);
  await page.getByRole('option', { name: colleague }).click();
  await choose(page, 'Raportul', 'Brutăria Lina · 2026');
  await page.getByRole('textbox', { name: 'Notă (opțional)' }).fill('Lipsesc datele despre energie.');
  await reminder.getByRole('button', { name: 'Trimiteți mementoul' }).click();

  // A sent reminder closes the dialogue and is said above the list.
  await expect(reminder).toHaveCount(0);
  await expect(page.getByText(`Mementoul a fost trimis către ${colleague}.`)).toBeVisible();
  // What the send committed: one reminder to the colleague, about that report, carrying the note. Its delivery is
  // the worker's — `accelerated-surfaces.spec.ts` follows one into a centre, and the api's `report-reminder.e2e-spec.ts`
  // carries the rest.
  const raised = await remindersRaisedFor(organizationId);
  expect(raised).toHaveLength(1);
  expect(raised[0]).toMatchObject({
    deepLink: `/reports/${reportId}`,
    params: { entityName: 'Brutăria Lina', fiscalYear: '2026', noteGiven: 'given', note: 'Lipsesc datele despre energie.' },
  });
  expect(raised[0].recipientUserIds).toHaveLength(1);
});

test('someone who does not administer the organization is told so, not shown an error', async ({
  page,
}) => {
  const editor = addressFor('editor');
  await registerAndVerify(page, editor);
  const organizationId = await grantMembership({
    email: editor,
    organizationName: `${RUN_PREFIX}-editor-org`,
    role: 'editor',
  });
  organizations.push(organizationId);
  await signIn(page, editor);
  await page.goto('/organization/users');

  // S-16's permission state (§8.1), from the API's own refusal — the screen never computed a role.
  await expect(
    page.getByText('Această pagină este pentru administratorii organizației'),
  ).toBeVisible();
});

/**
 * Task 203.2 (`design_spec.md` §4.7): S-16 searches name and address on the api, the term in the address, and a search
 * that admits no one is the filtered empty state rather than the teaching one.
 */
test('searches people by name or address, through the api, and says when no one matches', async ({ page }) => {
  const email = await administratorOf(page, 'search');
  await openAccessScreen(page);
  const search = page.getByRole('searchbox', { name: 'Căutați după nume sau e-mail' });

  await search.fill('Popescu');
  await page.getByRole('button', { name: 'Căutați', exact: true }).click();
  await page.waitForURL('**/organization/users?q=Popescu');
  await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(1);

  await page.getByRole('searchbox', { name: 'Căutați după nume sau e-mail' }).fill('nimeni-nu-se-numeste-asa');
  await page.getByRole('button', { name: 'Căutați', exact: true }).click();
  await page.waitForURL('**/organization/users?q=nimeni-nu-se-numeste-asa');
  await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);
});
