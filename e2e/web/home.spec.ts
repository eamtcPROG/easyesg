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

test('the home names the organization and states its role (UX-2, UC-16)', async ({ page }) => {
  await signedIn(page, 'single');

  // The heading is the organization, not a greeting: registration collects no display name
  // (OQ-16) and a Server Component cannot know the reader's time of day.
  await expect(
    page.getByRole('heading', { name: `${RUN_PREFIX}-single`, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Administrator al organizației').first()).toBeVisible();

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
    fallback. Measured at bytes 2,260 and 6,652 against the overview's fallback at 5,850 and its
    content at 8,474.

    Pinned in the positive form — their content is in the **shell**, ahead of the streamed filings —
    because that is what changes the day the global tier gains a boundary of its own. When it does,
    this goes red and the next reader learns why rather than wondering whether the skeletons ever
    worked.

    **Markers that can only be markup.** A first draft measured the skeletons' own CSS-module class
    names and found them at byte 15,785 — in the **stylesheet**, which carries every class whether or
    not the element rendered. The same shape as the fallback-label check task 115 had to correct.
  */
  const heading = html.indexOf(`${RUN_PREFIX}-streaming`);
  const memberships = html.indexOf('Organizațiile dumneavoastră');

  expect(heading, 'the heading was inlined, not streamed').toBeLessThan(fallback);
  expect(memberships, 'the membership list was inlined, not streamed').toBeLessThan(filings);
});
