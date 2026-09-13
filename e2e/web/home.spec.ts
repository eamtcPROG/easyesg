import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  grantMembership,
  seedOpenPeriod,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * S-05 in a real browser (UC-16, UC-67; FR-12, FR-23; task 30.5).
 *
 * **What a browser proves here is mostly what the screen refuses to say.** The membership list
 * states where the reader belongs without offering to switch (OQ-6 gives switching to task 83's
 * global tier), an edited `?joined=` announces nothing, and a viewer is offered no write. Each of
 * those is a sentence that would read as plausible if it were wrong.
 *
 * **Task 32.4 adds the one claim only a browser spans**: a period nobody has opened a report
 * against reaches the screen as a row with an action. That is FR-23's own sentence — *every entity
 * **and period*** — and it is a claim about a widened route, a Server Component read and a rendered
 * list at once. The rules over those rows are `overview.spec.ts`'s: the standing, the ordering and
 * the zone-aware deadline are pure, and every branch is asserted there rather than through this
 * slower surface.
 *
 * The arrival sentence's happy path is `invitation.spec.ts`'s, where the grant actually happens.
 */
const RUN_PREFIX = `e2e-web-home-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

/**
 * Signs a fresh account in and answers the organization it belongs to.
 *
 * **An object, because the two strings it answers are both organization-shaped ids and both
 * `string`** — the root file's rule about adjacent same-typed values, applied to a return rather
 * than to a call. It answered the email before task 32.4 and no caller read it.
 */
async function signedIn(
  page: Page,
  label: string,
  options: { readonly extraOrganizations?: number; readonly role?: 'editor' | 'viewer' } = {},
): Promise<{ readonly email: string; readonly organizationId: string }> {
  const { extraOrganizations = 0, role } = options;
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

  const organizationId = await grantMembership({
    email,
    organizationName: `${RUN_PREFIX}-${label}`,
    ...(role ? { role } : {}),
  });
  organizations.push(organizationId);
  for (let extra = 0; extra < extraOrganizations; extra += 1) {
    organizations.push(
      await grantMembership({ email, organizationName: `${RUN_PREFIX}-${label}-${extra}` }),
    );
  }

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  // **Wait for §4.3's branch to land before returning.** Not optional, and the trap
  // `users-access.spec.ts` documents: a `goto` issued before the redirect settles races the session
  // cookie, so the request arrives without one and the closed-by-default gate correctly bounces it
  // to sign-in. Every actor here holds at least one membership, so the branch lands on `/home`.
  await page.waitForURL('**/home');
  return { email, organizationId };
}

test('the home greets the reader and states the organization and role (UX-137, UX-2, UC-16)', async ({
  page,
}) => {
  await signedIn(page, 'single');

  // **The heading is the reader again since task 140**, which is the artboard's own anatomy: the
  // greeting over the organization. It named the organization from task 30.5 until OQ-16's name
  // half closed, because registration collected nothing to greet anybody by — `signedIn` fills
  // *Ana Popescu* on S-01, so this is UX-137's derivation end to end rather than a fixture.
  //
  // The salutation is plain rather than time-of-day, and the clock is the whole reason: a Server
  // Component cannot know the reader's local hour. That is task 30.5's second condition, not a half
  // of OQ-16 — which asks about the register's name field and its consent checkbox and nothing
  // about a clock.
  await expect(
    page.getByRole('heading', { name: 'Bine ați venit, Ana Popescu', level: 1 }),
  ).toBeVisible();

  // The organization is the tagline, and asserting the WHOLE line is what replaced a
  // `getByText(role).first()` — the role also appears in the membership list below, and `.first()`
  // was the only record of that ambiguity. Scoped to the `hgroup`, the count is exact.
  await expect(page.locator('hgroup p')).toHaveText(
    `${RUN_PREFIX}-single · Administrator al organizației`,
  );

  // §4.6's first-use state: an organization with no reporting period is taught what a filing is
  // and offered the one action that leads to creating one, which is the entity it hangs off.
  await expect(page.getByText('Nu există încă nicio perioadă de raportare')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vedeți entitățile' })).toBeVisible();
});

test('the membership list states where the reader belongs, and which is active', async ({
  page,
}) => {
  // Several memberships with no stated preference resolve no active organization (UX-2 makes the
  // choice deliberate), which is exactly the state task 83's switcher exists to end — so the
  // heading names none of them and the list is the only thing that can.
  await signedIn(page, 'several', { extraOrganizations: 1 });

  // Scoped to the list rather than the page: with several memberships the heading names none of
  // them, but the band and the heading are still places the same string can appear.
  const list = page.getByRole('list').filter({ hasText: `${RUN_PREFIX}-several` });
  await expect(list.getByText(`${RUN_PREFIX}-several`, { exact: true })).toBeVisible();
  await expect(list.getByText(`${RUN_PREFIX}-several-0`, { exact: true })).toBeVisible();
});

test('an edited ?joined= announces nothing', async ({ page }) => {
  await signedIn(page, 'edited');

  await page.goto('/home?joined=congratulations');
  // The parameter arrives through the address bar. A home that announced access to somebody who
  // typed it would be stating something the product never decided.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Ați primit acces')).toHaveCount(0);
});

test('the screen is live in all three locales', async ({ page }) => {
  const { organizationId } = await signedIn(page, 'locales');
  await seedReport({ organizationId, name: `${RUN_PREFIX}-locales-Brutăria` });

  // The two regions that always render once a filing exists, in each locale's own words. Separately
  // authored, never machine-translated — a catalogue edit here is what this assertion holds.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ce necesită atenție' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cum stau lucrurile' })).toBeVisible();
  await page.goto('/en/home');
  await expect(page.getByRole('heading', { name: 'What needs attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How everything stands' })).toBeVisible();
  await page.goto('/ru/home');
  await expect(page.getByRole('heading', { name: 'Что требует внимания' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Как обстоят дела' })).toBeVisible();
});

/**
 * **FR-23's own sentence, and the claim no unit spec spans.** A period nobody has opened a report
 * against is invisible to `GET /reports` by construction, so this row exists only because task
 * 32.4 widened `GET /periods` — the read, the Server Component and the rendered list all have to
 * be right for it to appear, and each of them looks correct on its own if it is wrong.
 */
test('a period nobody has started is a row with an action (UC-67, FR-23)', async ({ page }) => {
  const { organizationId } = await signedIn(page, 'unstarted');
  await seedOpenPeriod({ organizationId, name: `${RUN_PREFIX}-Moara`, fiscalYear: 2025 });

  await page.reload();
  const rows = page.getByRole('listitem').filter({ hasText: `${RUN_PREFIX}-Moara` });

  // **Exactly two, and the count is the assertion rather than a `.first()`.** One unstarted filing
  // answers two of UX-6's three questions — *what needs my attention* and *what is the state of
  // everything* — so two rows is the design; one would mean a region did not render and three would
  // mean the resume region had grown a copy of the row, which UX-6's *"reduces to one resumable
  // report"* rules out. The root file's rule: a locator that works around an ambiguity is that
  // ambiguity's only record.
  await expect(rows).toHaveCount(2);
  // **Counted, not `.first()`ed.** The count above is already asserted, so scoping these to one row
  // would let a list that rendered the chip in one region and not the other pass — and the two
  // regions are the same component, which is exactly the assumption worth holding to.
  await expect(rows.getByText('Neînceput')).toHaveCount(2);
  // The creation flow, with the entity already chosen. A row whose action pointed at the bare
  // creation screen would make the reader re-answer a question this row already knows.
  await expect(rows.getByRole('link', { name: 'Începeți raportul' })).toHaveCount(2);
});

/**
 * *Where did I leave off*, and the deadline marker — the two things UX-6 asks for that no other
 * screen carries. The overdue state is reachable in a browser only because the fixture can set a
 * due date; before task 32.4 it could not.
 */
test('names the report to resume and marks a deadline that has passed', async ({ page }) => {
  const { organizationId } = await signedIn(page, 'resume');
  await seedReport({
    organizationId,
    name: `${RUN_PREFIX}-Brutăria`,
    fiscalYear: 2024,
    // Comfortably past, so the assertion does not depend on the day this suite runs.
    dueDate: '2025-04-30',
  });

  await page.reload();
  // The resume region names the filing in a sentence and offers one link — not a fourth copy of the
  // row, which is why the *open* link below is unique on the page even though the filing itself
  // appears in two lists.
  await expect(page.getByRole('heading', { name: 'Unde ați rămas' })).toBeVisible();
  await expect(page.getByText(`${RUN_PREFIX}-Brutăria`)).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Continuați raportul' })).toHaveCount(1);
  // Two chips for two list rows — the deadline is past and the filing is unfinished, which is the
  // one thing on this screen that has to stand out.
  await expect(page.getByText('Termen depășit')).toHaveCount(2);
});

/**
 * FR-25's clause, applied to this screen: *a view-only member sees the same entries and no edit
 * affordances*. The row still renders — a viewer's whole job is seeing where things stand.
 */
test('offers a viewer no way to start a report', async ({ page }) => {
  const { organizationId } = await signedIn(page, 'viewer', { role: 'viewer' });
  await seedOpenPeriod({ organizationId, name: `${RUN_PREFIX}-Vizitator` });

  await page.reload();
  await expect(page.getByText(`${RUN_PREFIX}-Vizitator`)).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Începeți raportul' })).toHaveCount(0);
});

/**
 * **The overview's Suspense boundary, asserted rather than described** (11 Sep 2026).
 *
 * S-05's four regions are sibling Server Components; three read memberships, which is
 * React-`cache()`d and already in flight for the global tier, and one makes the `GET /periods` call
 * nothing else on the screen makes. Only that one is wrapped, so the heading and the membership list
 * flush while the filings stream in. Nothing else could catch the boundary being deleted: every
 * region renders identically once the stream settles, so the whole suite stays green and the screen
 * simply gets slower.
 *
 * **It reads positions, and the first draft read the label alone and was inert.** next-intl ships
 * the message catalogue to the client in the same payload, so *"Se încarcă starea raportărilor"* is
 * in the HTML whether the fallback rendered or not — the boundary-deleted build scored a hit on it
 * at byte 38,390 and the check passed. `role="status"` is the fallback as **markup**, and its
 * position before the filings is the actual claim: the shell was flushed before the overview
 * resolved. Proven both ways — with the boundary the fallback precedes the content, without it the
 * content arrives first and the markup appears nowhere.
 */
test('the overview streams behind its boundary, so the shell does not wait for it', async ({
  page,
}) => {
  const { organizationId } = await signedIn(page, 'streaming');
  await seedReport({ organizationId, name: `${RUN_PREFIX}-streaming-Brutăria` });

  const response = await page.goto('/home');
  const html = (await response?.text()) ?? '';

  const fallback = html.indexOf('role="status"');
  const filings = html.indexOf(`${RUN_PREFIX}-streaming-Brutăria`);

  expect(fallback, 'the fallback rendered into the shell').toBeGreaterThan(-1);
  expect(filings, 'the filings arrived in the same response').toBeGreaterThan(-1);
  expect(fallback, 'the shell flushed before the overview resolved').toBeLessThan(filings);

  /*
    **And the other two boundaries are inert today, which is asserted rather than assumed.**
    `OrganizationHeading` and `MembershipsSection` have boundaries and skeletons of their own —
    UX-90 requires the state to be defined — but neither can be seen: both read memberships, which
    is React-`cache()`d and awaited by `GlobalTier` **outside any boundary** in the `(app)` layout,
    so the shell cannot flush before their content exists and React inlines it instead of emitting a
    fallback.

    **Both assertions below replaced ones that could not fail on their subject** (task 126, found by
    the gate-integrity review, which measured rather than read).

    The first was `indexOf(`${'${RUN_PREFIX}'}-streaming`) < fallback`, called *the heading*. That string's
    first occurrence is at byte **2,260** and the 320 bytes before it are `GlobalTier`'s organization
    **plate** — the band, not this screen's `h1`, which sits at 5,540. So it measured a region in the
    layout and would have stayed green with `OrganizationHeading` streaming. `<hgroup` is this
    region's own markup, it occurs exactly **once** in the response (asserted, so the marker cannot
    silently acquire a second source), and it is here because task 124 corrected the element.

    The second was `memberships < filings`, called *inlined, not streamed*. The memberships read
    resolves before `GET /periods` returns whichever way the region renders, so React flushes it
    first either way: the assertion said "resolves before the periods call", which is
    unconditionally true. What actually distinguishes the two states is **how many boundaries were
    still pending when the shell flushed** — React SSR writes `<!--$?-->` for each one. Exactly one
    is the claim this screen makes, and the day the global tier gains a boundary of its own it
    becomes two and this goes red.

    **Markers that can only be markup.** A first draft measured the skeletons' own CSS-module class
    names and found them at byte 15,785 — in the **stylesheet**, which carries every class whether or
    not the element rendered. The same shape as the fallback-label check task 115 had to correct —
    and the 2,260 above is the third instance of that family: a marker that is real markup, but not
    the markup the sentence names.
  */
  const occurrences = (needle: string) => html.split(needle).length - 1;
  const hgroup = html.indexOf('<hgroup');

  // **Two, since task 128 — and the number is the assertion rather than a detail.** It was one:
  // the overview's, with the heading and the membership list inlined because both read memberships
  // and `GlobalTier` awaits that same memoized promise outside any boundary. The *data* is still
  // ready before the shell flushes, and the heading below proves it. What changed is the memberships
  // region's **shape**: task 128 split one async component with one `Promise.all` into a section, a
  // list and N async rows, each awaiting its own translators, so the subtree is still resolving when
  // the shell goes out. Its skeleton renders now, which is UX-90's state finally being used.
  //
  // Task 128 was verified narrowly and its commit said the count was "unchanged by construction
  // rather than by measurement". The construction argument was wrong, and this is the first browser
  // run since — tasks 128, 129 and 130 all waived the suite.
  expect(
    occurrences('<!--$?-->'),
    'two boundaries were still pending when the shell flushed — the overview and the memberships list',
  ).toBe(2);
  expect(occurrences('<hgroup'), 'S-05 draws exactly one hgroup, so it marks this region alone')
    .toBe(1);
  expect(hgroup, "the heading's own markup was inlined, not streamed").toBeLessThan(fallback);
});
