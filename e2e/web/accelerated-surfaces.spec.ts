import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
  addMember,
  cleanupAccounts,
  cleanupNotifications,
  cleanupOrganizations,
  grantMembership,
  inAppDeliveriesTo,
  issueInvitation,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * AD-15's two drivers, each proven twice — task 150's deliverable (§12.5.6's task-149 row and task 150's batch; NFR-110,
 * UX-138). **With the socket connected** a change arrives sooner than any poll could bring it; **with it refused** the
 * same change arrives on the poll, and not before. A driver carrying only the first half has made push the authority
 * without anyone deciding to, and nothing else in this repository would notice.
 *
 * **Everything runs the real path**: the write is a person's, in a second browser; its hint is an outbox row, drained
 * by the worker this suite has run since task 150, published on Redis and framed by the api to the socket the page
 * opened with its own ticket. Nothing is published by the test.
 *
 * **Time is the page's clock, held** (`page.clock`), so no poll can fire unless the test runs it. Connected, the clock
 * moves only in 100 ms ticks while the test waits — a held clock would stall TanStack Query too, which hands every
 * answer to React through a zero-delay `setTimeout` — so over NFR-110's three seconds it advances well under two
 * against polls of thirty and sixty: the only thing that can explain the change arriving is the frame. Refused, the
 * test runs the clock to just short of the poll — nothing — and then past it. **Refused is `page.routeWebSocket`**,
 * the socket closed before it reaches the api, on the build that ships, and the case checks it was attempted.
 *
 * The margins: a page's poll is scheduled from the moment it mounts, and the clock is held within a few seconds of
 * that, so *short of the poll* is well short of it and *past* is well past.
 */
const RUN_PREFIX = `e2e-web-push-${process.pid}-${Date.now()}`;
const PASSWORD = 'Parola123!';
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const organizations: string[] = [];

/** NFR-110: a committed change reflected within 3 s while the socket is live. */
const CONNECTED_WITHIN = 3_000;
/** OQ-36's intervals, as the page's clock is run against them. */
const ACCESS_LIST_POLL = 30_000;
const UNREAD_COUNT_POLL = 60_000;
/** How far short of a poll "not yet" is checked, and how far past it "now" is. */
const SHORT_OF_POLL = 10_000;
const PAST_POLL = 5_000;
/** How far one tick moves the page's clock while the test waits for an arrival. */
const TICK = 100;

/** The second browsers a case opened, closed after it so the next case's page is the only one listening. */
const opened: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(opened.splice(0).map((context) => context.close()));
});

test.afterAll(async () => {
  await cleanupNotifications(organizations);
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function registerAndVerify(page: Page, email: string, firstName = 'Ana'): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Prenume').fill(firstName);
  await page.getByLabel('Nume de familie').fill('Popescu');
  await page.getByLabel('E-mail de serviciu').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Creați contul' }).click();
  await page.waitForURL('**/verify');
  await page.goto(`/verify?token=${await verificationTokenFor(email)}`);
  await page.getByRole('button', { name: 'Confirmați adresa' }).click();
  await expect(page.getByText('Adresa este confirmată')).toBeVisible();
}

/** Sign in and wait for §4.3's branch to land where it lands, which is the signal the session exists. */
async function signIn(page: Page, input: { readonly email: string; readonly lands: string }): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(input.email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL(`**${input.lands}`);
}

/** A second person, in a browser of their own. */
async function anotherBrowser(browser: Browser): Promise<Page> {
  const context = await browser.newContext(test.info().project.use);
  opened.push(context);
  return context.newPage();
}

/** The socket either works or is refused before it reaches the api — set before the page loads. */
const SOCKET = { CONNECTED: 'connected', REFUSED: 'refused' } as const;
type SocketState = (typeof SOCKET)[keyof typeof SOCKET];

/**
 * Loads a page with its clock installed and the socket in the state given. Connected, it waits for the socket's ticket
 * to be spent and the api to have admitted it, so a change made next has a socket to reach; refused, for the page to
 * have tried and been refused, or the case would prove nothing about a refusal. The caller holds the clock (`hold`)
 * once the page is as the case needs it — an opened popover waits on an animation frame, which a held clock stops.
 */
async function openWithClock(page: Page, input: { readonly path: string; readonly socket: SocketState }): Promise<void> {
  let refusals = 0;
  if (input.socket === SOCKET.REFUSED) {
    await page.routeWebSocket(/\/api\/v1\/socket/u, (socket) => {
      refusals += 1;
      void socket.close();
    });
  }
  await page.clock.install();
  const opened = input.socket === SOCKET.CONNECTED ? page.waitForEvent('websocket') : null;
  await page.goto(input.path);
  if (opened) {
    await opened;
    // The upgrade and the replica's subscription are the api's, and the page is told of neither.
    await new Promise((settled) => setTimeout(settled, 1_000));
  } else {
    await expect.poll(() => refusals).toBeGreaterThan(0);
  }
}

/** Holds the page's clock: from here no timer fires unless the test moves it. */
const hold = (page: Page) => page.clock.pauseAt(new Date(Date.now() + 500));

/**
 * Waits for what a locator shows to be `expected`, moving the held clock one tick at a time — so a fetch that answered
 * can reach the screen, and no poll can. Within `timeout` of real time.
 */
async function arrives(
  page: Page,
  input: { readonly count: () => Promise<number>; readonly expected: number; readonly timeout?: number },
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.clock.runFor(TICK);
        return input.count();
      },
      { timeout: input.timeout ?? 10_000, intervals: [TICK] },
    )
    .toBe(input.expected);
}

const countOf = (locator: Locator) => () => locator.count();

/** Lets anything already answered reach the screen — a few ticks — before a check that nothing has changed yet. */
async function settle(page: Page): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await page.clock.runFor(TICK);
    await new Promise((settled) => setTimeout(settled, TICK));
  }
}

// ── S-16: an invitation someone else has just accepted ────────────────────────────────────────────────────────────

const accessRow = (page: Page, email: string) => page.getByRole('row').filter({ hasText: email });

/**
 * An administrator on S-16 with a pending invitation on screen, and the invitee signed in elsewhere, holding its link.
 * Returns the invitee's page and the link; accepting it is the write the driver is about.
 */
async function anInvitationAwaitingAcceptance(input: {
  readonly page: Page;
  readonly browser: Browser;
  readonly label: string;
  readonly socket: SocketState;
}): Promise<{ readonly invitee: Page; readonly inviteeEmail: string; readonly token: string }> {
  const administrator = addressFor(`${input.label}-oa`);
  await registerAndVerify(input.page, administrator);
  const organizationId = await grantMembership({ email: administrator, organizationName: `${RUN_PREFIX}-${input.label}` });
  organizations.push(organizationId);

  const inviteeEmail = addressFor(`${input.label}-invitee`);
  const invitee = await anotherBrowser(input.browser);
  await registerAndVerify(invitee, inviteeEmail);
  // A member of nothing lands on S-04, which is what acceptance changes.
  await signIn(invitee, { email: inviteeEmail, lands: '/create-organization' });
  const token = await issueInvitation({ organizationId, email: inviteeEmail });
  await invitee.goto(`/invitation/${token}`);

  await signIn(input.page, { email: administrator, lands: '/home' });
  await openWithClock(input.page, { path: '/organization/users', socket: input.socket });
  await expect(accessRow(input.page, inviteeEmail).getByText('Invitat', { exact: true })).toBeVisible();
  await hold(input.page);
  return { invitee, inviteeEmail, token };
}

async function accept(invitee: Page): Promise<void> {
  await invitee.getByRole('button', { name: 'Acceptați invitația' }).click();
  await invitee.waitForURL('**/home?joined=created');
}

test('S-16 gains an accepted invitation at once while the socket is connected', async ({ page, browser }) => {
  const { invitee, inviteeEmail } = await anInvitationAwaitingAcceptance({
    page,
    browser,
    label: 'access-live',
    socket: SOCKET.CONNECTED,
  });

  await accept(invitee);

  // The clock has moved by ticks alone, so no poll ran: the frame is the only thing that can have brought the member.
  await arrives(page, {
    count: countOf(accessRow(page, inviteeEmail).getByText('Activ', { exact: true })),
    expected: 1,
    timeout: CONNECTED_WITHIN,
  });
});

test('S-16 gains an accepted invitation on its poll while the socket is refused', async ({ page, browser }) => {
  const { invitee, inviteeEmail } = await anInvitationAwaitingAcceptance({
    page,
    browser,
    label: 'access-poll',
    socket: SOCKET.REFUSED,
  });

  await accept(invitee);

  // Short of the poll, nothing: the change committed, and with no frame the screen does not know yet.
  await page.clock.runFor(ACCESS_LIST_POLL - SHORT_OF_POLL);
  await settle(page);
  await expect(accessRow(page, inviteeEmail).getByText('Invitat', { exact: true })).toBeVisible();
  await expect(accessRow(page, inviteeEmail).getByText('Activ', { exact: true })).toHaveCount(0);

  // Past it, the screen's own read has run and the member is there.
  await page.clock.runFor(SHORT_OF_POLL + PAST_POLL);
  await arrives(page, { count: countOf(accessRow(page, inviteeEmail).getByText('Activ', { exact: true })), expected: 1 });
});

// ── S-26: a notice delivered to the reader — the band's count, and the open panel's list ─────────────────────────────

const bell = (page: Page, name: string) => page.getByRole('banner').getByRole('button', { name, exact: true });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Notificări' });

/**
 * A reader on their home with the panel open and nothing in it, and an administrator of the same organization on
 * S-16, in a browser of their own, with an open report to remind them about. Sending the reminder is the write; the
 * worker's in-app delivery of it is the change the reader's count and panel reflect.
 */
async function aReaderAwaitingAReminder(input: {
  readonly page: Page;
  readonly browser: Browser;
  readonly label: string;
  readonly socket: SocketState;
}): Promise<{ readonly administrator: Page; readonly reader: string; readonly organizationId: string }> {
  const administratorEmail = addressFor(`${input.label}-oa`);
  const administrator = await anotherBrowser(input.browser);
  await registerAndVerify(administrator, administratorEmail);
  const organizationId = await grantMembership({
    email: administratorEmail,
    organizationName: `${RUN_PREFIX}-${input.label}`,
  });
  organizations.push(organizationId);
  await seedReport({ organizationId, name: 'Brutăria Lina', fiscalYear: 2026 });

  // A name of the reader's own: the reminder form offers people by name, and the administrator is an Ana Popescu too.
  const reader = addressFor(`${input.label}-reader`);
  await registerAndVerify(input.page, reader, 'Maria');
  await addMember({ email: reader, organizationId, role: 'editor' });
  await signIn(input.page, { email: reader, lands: '/home' });
  await openWithClock(input.page, { path: '/home', socket: input.socket });
  await bell(input.page, 'Notificări, nimic necitit').click();
  await expect(panel(input.page).getByText('Nicio notificare deocamdată')).toBeVisible();
  await hold(input.page);

  await signIn(administrator, { email: administratorEmail, lands: '/home' });
  await administrator.goto('/organization/users');
  await administrator.getByRole('combobox', { name: 'Persoana', exact: true }).click();
  await administrator.getByRole('option', { name: 'Maria Popescu' }).click();
  await administrator.getByRole('combobox', { name: 'Raportul', exact: true }).click();
  await administrator.getByRole('option', { name: 'Brutăria Lina · 2026' }).click();
  return { administrator, reader, organizationId };
}

async function sendReminder(input: {
  readonly administrator: Page;
  readonly reader: string;
  readonly organizationId: string;
}): Promise<void> {
  await input.administrator.getByRole('button', { name: 'Trimiteți mementoul' }).click();
  await expect(input.administrator.getByText(/^Mementoul a fost trimis către /u)).toBeVisible();
  // The worker delivers on its own time; what follows is measured from its commit, as NFR-110 is.
  await expect
    .poll(() => inAppDeliveriesTo({ organizationId: input.organizationId, email: input.reader }), { timeout: 15_000 })
    .toBe(1);
}

test('the count and the open panel gain a delivered notice at once while the socket is connected', async ({
  page,
  browser,
}) => {
  const { administrator, reader, organizationId } = await aReaderAwaitingAReminder({
    page,
    browser,
    label: 'unread-live',
    socket: SOCKET.CONNECTED,
  });

  await sendReminder({ administrator, reader, organizationId });

  await arrives(page, { count: countOf(bell(page, 'Notificări, 1 necitită')), expected: 1, timeout: CONNECTED_WITHIN });
  await arrives(page, { count: countOf(panel(page).getByRole('listitem')), expected: 1, timeout: CONNECTED_WITHIN });
});

test('the count and the open panel gain a delivered notice on the poll while the socket is refused', async ({
  page,
  browser,
}) => {
  const { administrator, reader, organizationId } = await aReaderAwaitingAReminder({
    page,
    browser,
    label: 'unread-poll',
    socket: SOCKET.REFUSED,
  });

  await sendReminder({ administrator, reader, organizationId });

  await page.clock.runFor(UNREAD_COUNT_POLL - SHORT_OF_POLL);
  await settle(page);
  await expect(bell(page, 'Notificări, nimic necitit')).toBeVisible();
  await expect(panel(page).getByText('Nicio notificare deocamdată')).toBeVisible();

  // The count's poll reads one; a count that moved re-reads the open panel, whose floor that poll is.
  await page.clock.runFor(SHORT_OF_POLL + PAST_POLL);
  await arrives(page, { count: countOf(bell(page, 'Notificări, 1 necitită')), expected: 1 });
  await arrives(page, { count: countOf(panel(page).getByRole('listitem')), expected: 1 });
});
