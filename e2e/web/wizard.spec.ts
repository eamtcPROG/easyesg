import { expect, test, type Page } from '@playwright/test';
import {
  cleanupAccounts,
  cleanupOrganizations,
  disclosureValueOf,
  grantMembership,
  seedReport,
  verificationTokenFor,
} from './support/db';

/**
 * S-07's shell (task 35.1) — the one claim the deliverable makes: **B1–B11 navigable, and every step
 * has a URL that restores it.**
 *
 * UX-4 requires every addressable state to be addressable, and a wizard whose step lives in
 * component state fails it invisibly: it navigates perfectly until someone bookmarks a step, follows
 * a validation deep link (UX-22) or resumes on another device (FR-39). Only a browser can tell the
 * two implementations apart, which is why this journey exists rather than a unit test.
 *
 * **The report is seeded rather than created through the product**, because there is no way in yet:
 * S-06 is task 32.2.2 and blocked on task 36, and report creation is task 32.3. Stated here so the
 * fixture reads as the gap it is rather than as a shortcut.
 */
const RUN_PREFIX = `e2e-web-wizard-${process.pid}-${Date.now()}`;
const addressFor = (label: string) => `${RUN_PREFIX}-${label}@example.md`;
const PASSWORD = 'Parola123!';

const organizations: string[] = [];
/** Which organization a seeded report belongs to, so a case can read the store back under RLS. */
const organizationOf = new Map<string, string>();

test.afterAll(async () => {
  await cleanupOrganizations(organizations);
  await cleanupAccounts(RUN_PREFIX);
});

async function signedInWithReport(
  page: Page,
  label: string,
  sites?: readonly { readonly name: string; readonly locality: string }[],
): Promise<string> {
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
  });
  organizations.push(organizationId);
  const reportId = await seedReport({ organizationId, name: `${RUN_PREFIX}-entity`, ...(sites ? { sites } : {}) });
  organizationOf.set(reportId, organizationId);

  await page.goto('/sign-in');
  await page.getByLabel('Adresa de e-mail').fill(email);
  await page.getByLabel('Parolă', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Intrați în cont' }).click();
  await page.waitForURL('**/home');

  return reportId;
}

test('opens at a step, moves between modules, and every step restores from its URL (S-07, UX-4, UX-10)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'rc');

  // UX-10: opening a report places the reporter at the first incomplete step, and that step has its
  // own address from the first moment rather than after a client-side decision.
  await page.goto(`/reports/${reportId}`);
  await page.waitForURL(`**/reports/${reportId}/B1`);

  const rail = page.getByRole('navigation', { name: 'Secțiunile raportului' });
  await expect(rail.getByRole('link', { name: 'B1', exact: true })).toBeVisible();
  await expect(rail.getByRole('link', { name: 'C9', exact: true })).toBeVisible();

  // The current step is announced, not merely coloured — a rail that showed position visually only
  // would leave a screen-reader user unable to tell which of twenty modules they are in (NFR-75).
  await expect(page.getByRole('listitem').filter({ hasText: 'B1' }).first()).toHaveAttribute(
    'aria-current',
    'step',
  );

  await rail.getByRole('link', { name: 'B3', exact: true }).click();
  await page.waitForURL(`**/reports/${reportId}/B3`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B3');

  // The claim itself: the URL alone restores the step. A wizard holding its position in React state
  // passes every assertion above and fails this one.
  await page.goto(`/reports/${reportId}/B7`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B7');
  await expect(page.getByRole('listitem').filter({ hasText: 'B7' }).first()).toHaveAttribute(
    'aria-current',
    'step',
  );

  // UX-5's single, always-visible way out, which states that work is saved.
  await expect(page.getByRole('link', { name: /Ieșiți din raport/ })).toBeVisible();
});

test('answers a module the pinned taxonomy does not carry with a 404, not an empty shell', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'rc404');

  const response = await page.goto(`/reports/${reportId}/B99`);
  expect(response?.status()).toBe(404);
});

/**
 * B1 in a browser (task 36.2; UC-19, FR-24, FR-27, FR-28).
 *
 * What only this level can show: that the pre-filled values a reporter accepts **reach the store**,
 * that a typed axis reads as *Amplasament 1* rather than five interleaved questions, and that a
 * choice field offers the taxonomy's members instead of a text box. Each is a rendering the api
 * tests cannot see and the unit tests cannot compose.
 */
test('opens B1 pre-filled, stores what the reporter accepts, and groups the sites (FR-27, UX-109)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'b1', [
    { name: 'Hala', locality: 'Chișinău' },
    { name: 'Depozit', locality: 'Bălți' },
  ]);
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B1`);

  // Two sites from the snapshot, each its own group — the reading a flat list cannot give.
  const first = page.getByRole('group', { name: 'Amplasament 1' });
  const second = page.getByRole('group', { name: 'Amplasament 2' });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  // The site's LOCALITY, named — not `.first()` on the group. The fixture's snapshot carries a
  // locality and no address, so the first textbox is legitimately empty and a positional locator
  // would be asserting on whichever field the standard happens to order first.
  await expect(first.getByRole('textbox', { name: 'Localitatea amplasamentului' })).toHaveValue('Chișinău');
  await expect(second.getByRole('textbox', { name: 'Localitatea amplasamentului' })).toHaveValue('Bălți');

  // FR-27's other half: the defaults the reporter did not touch are stored on arrival, so a B1
  // nobody edited is still a B1 that was filed. The indicator is the screen's own claim; the store
  // is the fact (NFR-56) — **and only the second of those is asserted here** (convention review,
  // 8 Sep 2026). A wait on the indicator was the barrier this case appeared to have, and it was
  // none: `saveStateOf` answers `SAVED` both when nothing is pending *and* while a write is pending
  // inside UX-36's 250 ms anti-flicker budget, so it matched on arrival, before the defaults were
  // ever queued. The poll below is the barrier and the fact at once.
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({ organizationId, reportId, elementKey: 'CityOfSite' }))?.valueText,
      { timeout: 15_000 },
    )
    .toBe('Chișinău');
});

test('offers a choice field the taxonomy’s own members, not a text box (task 91.1)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b1choice', [{ name: 'Hala', locality: 'Chișinău' }]);

  await page.goto(`/reports/${reportId}/B1`);

  // `UndertakingsLegalForm` is an enumeration. Until task 36.2 every one of B1's ten choice fields
  // rendered as free text, which the api's members made answerable and nothing on the screen used —
  // so this asserts the ROLE, which is the only thing that tells the two implementations apart.
  const legalForm = page.getByRole('combobox', { name: 'Forma juridică a întreprinderii' });
  await expect(legalForm).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Forma juridică a întreprinderii' })).toHaveCount(0);

  // And its members are the domain's, worded — not member keys, which no reader may be shown.
  await legalForm.click();
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();
  for (const text of await options.allInnerTexts()) expect(text).not.toContain('Member');
});

test('counts a narrative field’s length, and imposes no limit on it (UX-19)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b1text', [{ name: 'Hala', locality: 'Chișinău' }]);

  await page.goto(`/reports/${reportId}/B1`);
  const narrative = page.getByRole('textbox', {
    name: 'Descrierea certificărilor sau etichetelor legate de sustenabilitate',
  });
  await narrative.fill('ISO 14001');

  // The count is the half of UX-19 that has a source; the soft target is deferred with no corpus.
  await expect(page.getByText('9 caractere')).toBeVisible();
  await expect(narrative).not.toHaveAttribute('maxlength', /.+/u);
});

/** The three control words this case reads, from `organization.wizard.field` — the catalogue owns
 *  them, and naming them here keeps the assertions about behaviour rather than about wording. */
const FIELD_WORDS = { choose: 'Alegeți', yes: 'Da' } as const;

/**
 * B2 end to end (UC-20, FR-24; task 36.3) — **the module that tests whether task 36.2 built B1 or
 * built the anatomy.**
 *
 * B2 is the narrative module: six elements, no axis on any of them and no applicability rule
 * touching it, so nothing here is B1's shape. Its four kinds — `text_block`, `monetary`, `boolean`
 * and `enumeration_set` — are all kinds B1 also carries, which is exactly why this case is worth
 * running rather than assuming: if 36.2's dispatch is generic over the taxonomy, B2 needs no code,
 * and the only way to know that is to drive it.
 *
 * It asserts one field of each kind, and the store rather than the screen for the two that carry
 * UC-20's own content — *"largely free-text with structured yes/no anchors"*.
 */
test('B2 renders and stores each of its kinds, with no code of its own (UC-20)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b2');
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B2`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('B2');

  // 1 — the narrative half of UC-20, and the first `text_block` outside B1. Its count is UX-19's,
  //     which `disclosure-control.tsx` renders for every `text_block` rather than for B1's one.
  const narrative = page.getByRole('textbox', {
    name: 'Descrierea participării efective a lucrătorilor, utilizatorilor sau a altor părți interesate ori comunități la guvernanță',
  });
  await narrative.fill('Consiliul consultativ se întrunește trimestrial.');
  // **48, which is Romanian's `other` plural — *"de caractere"*.** B1's own case asserts 9 and gets
  // `few`, so this is the first time the count's third form is rendered at all: `ro` has one/few/
  // other, few covering n%100 in 1..19, and a catalogue that had only ever been read at 9 could
  // have carried a wrong `other` form indefinitely. UX-95's whole-message rule is what makes this
  // the catalogue's business rather than a component's.
  await expect(page.getByText('48 de caractere')).toBeVisible();

  // 2 — `monetary`. It renders as a decimal field and carries NO unit — and since task 91.4 the
  //     reason is EFRAG's rather than this platform's: `measurementGuidance` reaches 42 elements
  //     and no monetary one is among them, so `unitCodes` is empty and the anatomy omits the slot.
  //     A currency marker here would still be invented; what changed is that the taxonomy now says
  //     so, where before nothing had asked it (UX-14; the currency question itself is task 30.2's).
  const investment = page.getByRole('textbox', {
    name: 'Investiția financiară în capitalul sau activele entităților din economia socială',
  });
  await expect(investment).toHaveAttribute('inputmode', 'decimal');
  await investment.fill('125000');
  // **Blurred explicitly, because blur IS the commit** (UX-34: *"on blur or step change"*). The
  // narrative above committed only because filling this field took focus off it — so a case that
  // ends on a typed field asserts a store that was never written, which is what the first run of
  // this test did. Nothing else in the suite typed into the LAST field of a step.
  await investment.blur();

  /*
   * 3 — the structured yes/no anchor UC-20 names, rendered as **a Select that starts empty**, which
   *     is `architecture.md` §12.5.6's task-35.2 decision — *boolean as a two-option `Select`* —
   *     and the property rather than the widget is what this asserts. A disclosure has three
   *     answers: unanswered, yes, no. A checkbox holds two, so it would make *not answered yet*
   *     indistinguishable from *no*.
   *
   *     **The emptiness is the assertion, and the first draft did not have it** (found by review):
   *     it asserted a combobox and the absence of a checkbox, and the second of those can never be
   *     the failing one — Playwright throws on the first failed expect, so a boolean that regressed
   *     to a checkbox fails the line above it and the count never runs. A trigger pre-set to a
   *     value is the defect that assertion pair could not see.
   */
  const target = page.getByRole('combobox', {
    name: 'Întreprinderea a stabilit o țintă legată de o politică',
  });
  await expect(target).toHaveText(FIELD_WORDS.choose);
  await target.click();
  await page.getByRole('option', { name: FIELD_WORDS.yes, exact: true }).click();
  await expect(target).toHaveText(FIELD_WORDS.yes);

  /*
   * 4 — `enumeration_set`, and **the assertion is that it is searchable, not that it is a
   *     combobox** (found by review). `Select` and `Combobox` both expose `role="combobox"`, so a
   *     visibility check cannot tell a multi-select over the taxonomy's members from the
   *     two-option Select the boolean above renders — an `ENUMERATION_SET` mis-dispatched to a
   *     `Select` would satisfy it exactly as well as correct code. Typing is what distinguishes
   *     them: only `Combobox` filters, and a `Select` trigger takes no text at all.
   */
  const issues = page.getByRole('combobox', {
    name: 'Aspectele de sustenabilitate abordate prin practică, politică și/sau inițiativă viitoare',
  });
  await issues.fill('clim');
  await expect(page.getByRole('option').first()).toBeVisible();

  // The store is the fact, not the indicator (NFR-56). One text and one numeric, because those are
  // two different value columns and a dispatch that got either wrong would still look right.
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });
  await expect
    .poll(
      async () =>
        (
          await disclosureValueOf({
            organizationId,
            reportId,
            elementKey:
              'DescriptionOfTheEffectiveParticipationOfWorkersUsersOrOtherInterestedPartiesOrCommunitiesInGovernance',
          })
        )?.valueText,
      { timeout: 15_000 },
    )
    .toBe('Consiliul consultativ se întrunește trimestrial.');
  await expect
    .poll(
      async () =>
        (
          await disclosureValueOf({
            organizationId,
            reportId,
            elementKey: 'FinancialInvestmentInTheCapitalOrAssetsOfSocialEconomyEntities',
          })
        )?.valueNumeric,
      { timeout: 15_000 },
    )
    .toBe('125000');

  /*
   * The deliverable's own clause — *"stored in three locales"*. **The label is the assertion**,
   * because it is the one string on this screen the app does not own: task 33.2 resolves an element
   * key against the report's **pinned** version through `platform/localization`, and OQ-58 serves it
   * on the step read rather than from any bundle. So this proves the API answered in the request's
   * language, which no unit test on this side can. The numeric field is not re-asserted per locale
   * because a stored number has no locale — NFR-26 governs how it is *displayed* and this field
   * shows the raw draft. (An earlier draft cited NFR-58 for that, which is a billing requirement
   * about minor units and the BNM rate and says nothing about it.)
   */
  await page.goto(`/en/reports/${reportId}/B2`);
  await expect(
    page.getByRole('textbox', { name: /^Description of the effective participation of workers/u }),
  ).toHaveValue('Consiliul consultativ se întrunește trimestrial.');
  await page.goto(`/ru/reports/${reportId}/B2`);
  // The same pair as `en`, not visibility alone: a defect that resolved the Russian LABEL while
  // losing the field's VALUE under `ru` — a locale-keyed lookup confusion — would pass a
  // visibility check silently, and `en` would catch the same defect. Asymmetric coverage of two
  // locales is coverage of one (found by review).
  await expect(
    page.getByRole('textbox', { name: /^Описание фактического участия работников/u }),
  ).toHaveValue('Consiliul consultativ se întrunește trimestrial.');
});

/**
 * B3's energy breakdown in a browser (UC-21, FR-24; task 36.4).
 *
 * **The one claim that spans everything this task built**: the extractor now emits the axis
 * members' labels, the api expands a registered breakdown axis into one row per member, and the
 * step lays them out under one legend. Each of those is asserted on its own — the labels by
 * `disclosure-catalogues.parity`, the rows by `wizard.e2e-spec.ts`, the layout by
 * `step-layout.spec.ts` — and only a browser can say they meet.
 *
 * UC-21 step 1 asks for consumption *"split by renewable and non-renewable source"*, which was
 * unreportable before this task: the 34 elements on explicit axes served one undimensioned row.
 */
test('B3 reports energy along its breakdown, named by member (UC-21)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b3');
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B3`);

  // The element names the group; the members name the rows. **Not the other way round** — the
  // repeating groups B1 draws put the position in the legend, and reading a breakdown that way
  // would give three fields all called *Energy consumption from fuels*.
  const group = page.getByRole('group', { name: 'Consumul de energie din combustibili' });
  await expect(group).toBeVisible();

  // **`exact`, and the ambiguity it resolves is the standard's own.** The total is *"Total energie
  // regenerabilă și neregenerabilă"*, which CONTAINS the renewable member's whole name — so a
  // default substring match resolves two textboxes and strict mode refuses. Nested member names are
  // a property of the breakdown, not a locator accident, which is why this is exactness rather than
  // a `.first()` (the root file's rule: a test that works around an ambiguity is its only record).
  for (const member of [
    'Total energie regenerabilă și neregenerabilă',
    'Energie regenerabilă',
    'Energie neregenerabilă',
  ]) {
    await expect(group.getByRole('textbox', { name: member, exact: true })).toBeVisible();
  }
  // Exactly three, so a fourth member appearing — or the total being dropped — fails here.
  await expect(group.getByRole('textbox')).toHaveCount(3);

  // The member is stored, not just displayed: §7.3 keys a value by (element, dimension, ordinal),
  // and a breakdown that wrote every row to the undimensioned key would look right and hold one.
  const renewable = group.getByRole('textbox', { name: 'Energie regenerabilă', exact: true });
  await renewable.fill('120');
  await renewable.blur();
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });

  // **Both halves, because the indicator reads *Salvat* whichever key was written** (convention
  // review, 8 Sep 2026 — the first version of this case asserted only the indicator and claimed the
  // sentence above). The member row holds the figure…
  const stored = { organizationId, reportId, elementKey: 'EnergyConsumptionFromFuels' };
  await expect
    .poll(async () => (await disclosureValueOf({ ...stored, dimensionKey: 'RenewableEnergyMember' }))?.valueNumeric, {
      timeout: 15_000,
    })
    .toBe('120');
  // …and the undimensioned row — the one a breakdown that ignored its members would have written —
  // does not exist. Without this the case passes on exactly the defect it names.
  expect(await disclosureValueOf(stored)).toBeNull();
});

/**
 * B4 in a browser (UC-22, FR-24, FR-29; task 36.5) — **the classification, end to end**.
 *
 * The third row shape, and the one that spans every layer this task touched: the axis is registered
 * as a classification in the configuration store, the api serves its 94 members once on the step and
 * the rows the report holds, `layOutStep` transposes them into one row per pollutant, and the picker
 * names the row that the amounts are then keyed to. Each is asserted on its own — the shape by
 * `axis-shape.service.spec.ts`, the rows by `wizard.e2e-spec.ts`, the grouping by
 * `step-layout.spec.ts` — and only a browser can say that they meet.
 *
 * UC-22 step 1 asks for emissions to air, water and soil, which EFRAG's own sheet asks **per
 * pollutant**: unreportable before this task, since the three elements served one undimensioned row
 * with nothing naming what it measured.
 */
test('B4 reports an emission against a pollutant the reporter names (UC-22)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b4');
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B4`);

  // The unassigned row the api serves so the module can be started at all: it names the domain and
  // asks which member, and — deliberately — shows **no amounts yet**. A value written before a
  // pollutant is named would be stored under the undimensioned key and never read back.
  const unassigned = page.getByRole('group', { name: 'Tipul de poluant — de ales' });
  await expect(unassigned).toBeVisible();
  await expect(unassigned.getByRole('textbox', { name: 'Cantitatea de emisii în aer' })).toHaveCount(0);

  // 94 pollutants, filtered locally. **Not 94 rows** — the count is what separates a classification
  // from a breakdown, and getting it wrong is 282 fields on one screen.
  const picker = unassigned.getByRole('combobox', { name: 'Tipul de poluant' });
  await picker.fill('Amoniac');
  await page.getByRole('option', { name: 'Amoniac (NH3)' }).click();

  // Named, the row asks its three amounts — EFRAG's own `Pollutant │ air │ water │ soil`.
  const ammonia = page.getByRole('group', { name: 'Amoniac (NH3)' });
  const air = ammonia.getByRole('textbox', { name: 'Cantitatea de emisii în aer' });
  await air.fill('12');
  await air.blur();
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });

  // **The member is the key, and the indicator cannot tell you that** — it reads *Salvat* whichever
  // dimension was written. The pollutant's row holds the figure…
  const stored = { organizationId, reportId, elementKey: 'AmountOfEmissionToAir' };
  await expect
    .poll(async () => (await disclosureValueOf({ ...stored, dimensionKey: 'AmmoniaNH3Member' }))?.valueNumeric, {
      timeout: 15_000,
    })
    .toBe('12');
  // …and the undimensioned row — the one a classification that ignored its member would have
  // written, and which no read would ever show again — does not exist.
  expect(await disclosureValueOf(stored)).toBeNull();

  // It survives the round trip, which is the half a fresh render cannot fake: the api recomposes
  // the row from the member the store holds, not from anything the browser remembered.
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Amoniac (NH3)' }).getByRole('textbox', {
      name: 'Cantitatea de emisii în aer',
    }),
  ).toHaveValue('12');
  // And the picker is gone from a row the store has named: moving it would strand the answers under
  // a pollutant nobody reports.
  await expect(page.getByRole('group', { name: 'Amoniac (NH3)' }).getByRole('combobox', {
    name: 'Tipul de poluant',
  })).toHaveCount(0);
});

/**
 * B7 in a browser (UC-25, FR-24, FR-29; task 36.8) — **the module that exercises everything at once.**
 *
 * At 19 elements over five sections B7 is the largest in Basic, and the only one carrying all three
 * group shapes together: a **classification** over the 973-member EU List of Waste (36.5's machinery),
 * a **typed axis** for materials (36.2's, named by 36.6's rule), and ten undimensioned fields — eight
 * figures with 91.4's units in both branches, a boolean and a narrative. What is new here is the domain itself: it is published by EFRAG in
 * English alone, and only its *leaves* are valid answers.
 */
test('B7 reports waste against an entry of the published list, and says whose language it is (UC-25)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'b7');
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B7`);

  // Section 1 is two undimensioned fields, and it is what makes B7 *narrative and figures in one
  // module* — the thing 36.8's row says the anatomy must carry without a bespoke field.
  await expect(
    page.getByRole('group', { name: 'Întreprinderea aplică principiile economiei circulare' }),
  ).toBeVisible();

  // The waste table's unassigned row, named from the workbook's own column header rather than from
  // the axis — EFRAG publishes no name for this domain, and `Rând` is what a reader would otherwise
  // have met.
  const unassigned = page.getByRole('group', { name: 'Tipul de deșeu — de ales' });
  await expect(unassigned).toBeVisible();

  const picker = unassigned.getByRole('combobox', { name: 'Tipul de deșeu' });
  // **The language note, said where the names are** (UX-47 and UX-98's on-screen counterpart). It
  // is `Combobox`'s help slot, so it is announced with the field rather than as a loose sentence.
  await expect(unassigned).toContainText('Această clasificare este publicată doar în engleză');

  // A leaf, found by its code — which is what a reporter matches against their own waste manifest,
  // and the half of the entry that is language-independent.
  await picker.fill('01 01 01');
  await page.getByRole('option', { name: /Wastes from mineral metalliferous excavation/u }).click();

  const entry = page.getByRole('group', { name: 'Wastes from mineral metalliferous excavation' });
  // **Six figures on this row, not three.** EFRAG's sheet shows three quantity columns and a
  // mass-or-volume switch; the taxonomy models six elements, and §12.5.6 records the divergence
  // rather than inventing the pairing rule a switch would need.
  await expect(entry.getByRole('textbox')).toHaveCount(6);

  const diverted = entry.getByRole('textbox', {
    name: 'Deșeuri direcționate spre reciclare sau reutilizare (masă)',
  });
  await diverted.fill('340');
  await diverted.blur();

  // The figure is keyed to the waste entry the reporter chose, not to the undimensioned row a
  // classification that ignored its member would have written.
  const stored = { organizationId, reportId, elementKey: 'WasteDivertedToRecycleOrReuseMass' };
  await expect
    .poll(
      async () =>
        await disclosureValueOf({
          ...stored,
          dimensionKey: 'W-010101-Non-Hazardous-WastesFromMineralMetalliferousExcavationMember',
        }),
      { timeout: 15_000 },
    )
    .toMatchObject({ valueNumeric: '340', unitCode: 'kg' });
  expect(await disclosureValueOf(stored)).toBeNull();
});

/**
 * B8 in a browser (UC-26, FR-24, FR-28, FR-29; task 36.9) — **the countries nobody had named.**
 *
 * B8's country table is a classification over `CountryOfEmploymentContractAxis`, whose 256 ISO 3166
 * codes are worded **nowhere**: EFRAG references the list rather than publishing it, so before this
 * task the picker would have offered `AD, AE, AF`. The names are the platform's to give and come
 * from `Intl.DisplayNames` in the request's locale, resolved in the api like every other member
 * name — which is what this journey shows, because only a browser reads them in Romanian.
 *
 * Its other seven fields are the flat labelled list B1 … B7 ship, which is the recorded answer to
 * the row's *"entered as a table, not eleven fields"*: EFRAG's row label and our field label say the
 * same thing.
 */
test('B8 asks headcount per named country, and turnover only past fifty (UC-26)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b8');
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B8`);

  // The contract and gender counts, each a fully labelled field rather than a table row.
  await expect(
    page.getByRole('group', { name: 'Numărul de angajați cu contract pe durată nedeterminată' }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'Numărul de angajați de gen masculin' })).toBeVisible();

  // **No turnover below fifty** — BR-APP-1's threshold, and the field is absent rather than shown
  // and refused (P2). B1 is untouched, so the headcount is unanswered.
  await expect(
    page.getByRole('group', { name: 'Rata de fluctuație a personalului' }),
  ).toHaveCount(0);

  // The country table, named from EFRAG's own column header because its axis and its default member
  // are both unworded.
  const unassigned = page.getByRole('group', { name: 'Țara contractului de muncă — de ales' });
  const picker = unassigned.getByRole('combobox', { name: 'Țara contractului de muncă' });

  // **Romanian, from the platform.** `Republica Moldova` appears in no catalogue and in no EFRAG
  // file — it is `Intl.DisplayNames` resolved against the request's negotiated locale, which is the
  // half only a browser can show.
  await picker.fill('Moldova');
  await page.getByRole('option', { name: 'Republica Moldova', exact: true }).click();

  const md = page.getByRole('group', { name: 'Republica Moldova' });
  const headcount = md.getByRole('textbox', { name: 'Numărul de angajați pe țara contractului de muncă' });
  await headcount.fill('42');
  await headcount.blur();

  // Keyed to the country, not to the undimensioned row.
  const stored = { organizationId, reportId, elementKey: 'NumberOfEmployeesForCountryOfEmploymentContract' };
  await expect
    .poll(async () => await disclosureValueOf({ ...stored, dimensionKey: 'MD' }), { timeout: 15_000 })
    .toMatchObject({ valueNumeric: '42' });
  expect(await disclosureValueOf(stored)).toBeNull();

  // ── The other side of fifty ────────────────────────────────────────────────────────────────
  //
  // **The half the api's own BR-APP-1 case cannot show**: that the field is *not rendered* rather
  // than rendered and refused (§7.3, P2). Answering B1's headcount at 50 brings it in.
  await page.goto(`/reports/${reportId}/B1`);
  const employees = page.getByRole('group', { name: 'Numărul de angajați' }).getByRole('textbox');
  await employees.fill('50');
  await employees.blur();
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({ organizationId, reportId, elementKey: 'NumberOfEmployees' }))?.valueNumeric,
      { timeout: 15_000 },
    )
    .toBe('50');

  await page.goto(`/reports/${reportId}/B8`);
  const turnover = page.getByRole('group', { name: 'Rata de fluctuație a personalului' });
  await expect(turnover).toBeVisible();

  // ── UX-28, in its three parts ───────────────────────────────────────────────────────────────
  //
  // *"Where a conditional field **disappears** after being answered, the entered value shall be
  // retained and **restored if the condition returns**."* Three claims, and only a browser can make
  // the first and third: the field **goes**, the answer **stays in storage**, and it **comes back**.
  //
  // **This block asserted the opposite until 9 Sep 2026**, and the reason is worth keeping. UX-28
  // was read as an exception to §7.3's *"Not applicable — Not rendered"* — as though it required the
  // answered field to stay on screen — so the test asserted a visible box still holding `12`. It
  // passed against a screen that rendered every field regardless, which is to say it could not fail
  // for the reason it existed. The sentence presupposes the disappearance rather than forbidding it,
  // and `EmployeeTurnoverRate` is the only field in the product that can currently demonstrate all
  // three parts, because nothing else is answered and then made inapplicable.
  const rate = turnover.getByRole('textbox');
  await rate.fill('12');
  await rate.blur();
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({ organizationId, reportId, elementKey: 'EmployeeTurnoverRate' }))?.valueNumeric,
      { timeout: 15_000 },
    )
    .toBe('12');

  // The undertaking shrinks below the threshold. The rule stops applying to the field…
  await page.goto(`/reports/${reportId}/B1`);
  const shrunk = page.getByRole('group', { name: 'Numărul de angajați' }).getByRole('textbox');
  await shrunk.fill('10');
  await shrunk.blur();
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({ organizationId, reportId, elementKey: 'NumberOfEmployees' }))?.valueNumeric,
      { timeout: 15_000 },
    )
    .toBe('10');

  // …so the question goes — §7.3's third condition, which is the half the api cannot show…
  await page.goto(`/reports/${reportId}/B8`);
  await expect(page.getByRole('group', { name: 'Rata de fluctuație a personalului' })).toHaveCount(0);

  // …and the answer is **retained** while the question is gone. Read from the store rather than from
  // the screen, which is the only place it can be read now — and the assertion the "field stays
  // visible" version could never make, because it was reading the same fact twice.
  expect(
    (await disclosureValueOf({ organizationId, reportId, elementKey: 'EmployeeTurnoverRate' }))?.valueNumeric,
  ).toBe('12');

  // …and it is **restored** when the condition returns, without the reporter retyping it.
  await page.goto(`/reports/${reportId}/B1`);
  const regrown = page.getByRole('group', { name: 'Numărul de angajați' }).getByRole('textbox');
  await regrown.fill('50');
  await regrown.blur();
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({ organizationId, reportId, elementKey: 'NumberOfEmployees' }))?.valueNumeric,
      { timeout: 15_000 },
    )
    .toBe('50');

  await page.goto(`/reports/${reportId}/B8`);
  await expect(
    page.getByRole('group', { name: 'Rata de fluctuație a personalului' }).getByRole('textbox'),
  ).toHaveValue('12');
});

/**
 * UX-15's declaration, in a browser (UC-31, FR-32, D-4; task 36.5).
 *
 * *"Every field shall offer the 'not available, with reason' declaration as a first-class action,
 * not as an alternative discovered after failing to answer."* Built on B4 because UC-22's alternate
 * flow makes the reasoned non-answer this module's **common** path, and built once for all eleven
 * modules because every one of them needs it.
 */
test('a field can be declared not available, with a reason, and answered after all (UX-15)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'b4gap');
  const organizationId = organizationOf.get(reportId) ?? '';

  await page.goto(`/reports/${reportId}/B4`);
  const url = page.getByRole('group', {
    name: 'Adresa URL sau linkul către informația disponibilă public',
  });

  // First-class: the action is on the field, before anything has been typed into it.
  await url.getByRole('button', { name: 'Marcați ca indisponibil' }).click();
  const reason = url.getByRole('textbox', { name: 'Motivul pentru care valoarea nu este disponibilă' });
  // §7.4 carries the reason into both export formats, and the interface says so where it is
  // typed. (UX-30 is the *section* rationale's rule, in §6.5 — not this one.)
  await expect(url.getByText('Acest text apare în raportul exportat, unde îl va citi un terț.')).toBeVisible();
  await reason.fill('Raportul de mediu nu este publicat online');
  await url.getByRole('button', { name: 'Confirmați' }).click();

  const stored = {
    organizationId,
    reportId,
    elementKey: 'URLOrLinkToThePubliclyAvailableDisclosure',
  };
  await expect
    .poll(async () => await disclosureValueOf(stored), { timeout: 15_000 })
    .toMatchObject({
      state: 'not_available',
      notAvailableReason: 'Raportul de mediu nu este publicat online',
    });

  // The reason is what a reader sees, on the field, in their own language — never the state's key.
  await expect(url.getByText('Raportul de mediu nu este publicat online')).toBeVisible();

  // **Reversible** (UX-29's word for the section case, and the same expectation here): the field
  // returns to unanswered rather than to a value the reporter withdrew, and the reason goes with
  // the state it explained — the store's own `CHECK` pairs the two.
  await url.getByRole('button', { name: 'Reveniți la completare' }).click();
  await expect
    .poll(async () => await disclosureValueOf(stored), { timeout: 15_000 })
    .toMatchObject({ state: 'missing', notAvailableReason: null, valueText: null });
});

/**
 * UX-14's two branches in a browser (task 91.4).
 *
 * *"Every quantitative field shall carry an explicit unit, either **fixed by the taxonomy** or
 * **chosen from a constrained list**. Free-text units are prohibited."* Both branches are real in
 * EFRAG's data — 25 elements admit one unit and 13 admit several — and only a browser can show that
 * they render as two different controls off one field, since the api serves one `unitCodes` list
 * and the difference is `length`.
 *
 * **B4 is the module that made this task precede 36.5**: EFRAG's own Digital Template asks its
 * three emissions in *"either kg or tonne"* on the sheet itself, so shipping B4 with no chooser
 * would have stored three masses whose unit nothing recorded.
 */
test('a unit is shown where the standard fixes it and asked where it admits several (UX-14)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'units');
  const organizationId = organizationOf.get(reportId) ?? '';

  // ── Fixed by the taxonomy: B3's total energy admits MWh alone ──────────────────────────────
  await page.goto(`/reports/${reportId}/B3`);
  const total = page.getByRole('group', { name: 'Consumul total de energie' });
  await expect(total.getByText('MWh', { exact: true })).toBeVisible();
  // Shown, never asked. A chooser over one option is a control that cannot change anything, and
  // it would put a menu on 25 of the 38 fields that carry a unit at all.
  await expect(total.getByRole('combobox')).toHaveCount(0);

  // ── Chosen from a constrained list: B4's emissions admit kilograms or tonnes ───────────────
  //
  // **The pollutant comes first, and that is task 36.5's shape rather than a setup step**: B4's
  // amounts are cells of a classification row, so they do not exist until the row is named. An
  // amount asked before *of what* is exactly what that task removed.
  await page.goto(`/reports/${reportId}/B4`);
  await page
    .getByRole('group', { name: 'Tipul de poluant — de ales' })
    .getByRole('combobox', { name: 'Tipul de poluant' })
    .fill('Azbest');
  await page.getByRole('option', { name: 'Azbest' }).click();

  const air = page.getByRole('group', { name: 'Cantitatea de emisii în aer' });
  const unit = air.getByRole('combobox');
  await expect(unit).toHaveCount(1);
  // **Empty until chosen** (project owner, 8 Sep 2026). `unitCodes` is `[kg, t]` and EFRAG's own
  // template ships tonnes pre-selected, so nothing makes the list an order of preference — and with
  // task 91.2's commit rule a default would have filed a unit nobody picked, at a thousandfold
  // error. UX-14 asks for an *explicit* unit; this is what explicit means.
  await expect(unit).toHaveText('Alegeți');

  // The unit travels with the value, and 12 kg is not 12 t — so the write has to carry both.
  await unit.click();
  await page.getByRole('option', { name: 't', exact: true }).click();
  const amount = air.getByRole('textbox');
  await amount.fill('12');
  await amount.blur();
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });

  // **The stored row is the fact, not the indicator** — which reads *Salvat* whichever unit was
  // written. Without this line the case passes on a chooser that changes nothing but the label.
  await expect
    .poll(
      async () =>
        await disclosureValueOf({
          organizationId,
          reportId,
          elementKey: 'AmountOfEmissionToAir',
          dimensionKey: 'AsbestosMember',
        }),
      { timeout: 15_000 },
    )
    .toMatchObject({ valueNumeric: '12', unitCode: 't' });
});

/**
 * B5 in a browser (UC-23, FR-24, FR-28; task 36.6) — **a site the report knows about is a B5 row,
 * named by the report's own answer for it.**
 *
 * `design_spec.md` §6.1 makes B5 *"site-driven from the B1 site geolocations"* and UC-23 asks the
 * question *"using the B1 site geolocations"*. Task 91.3 built the applicability half — the fields
 * appear once B1 lists a site — and the rows were the half nothing built: measured before this
 * task, a three-site report served **one** B5 row, unnamed. A reporter asked *is this site in a
 * biodiversity-sensitive area?* could not tell which site was being asked about.
 *
 * `IdentifierOfSiteTypedAxis` is presented in B1 **and** B5 (task 36.4's repair), so this is one
 * rule rather than a B5 feature: a typed axis's rows belong to the axis, not to each element.
 */
test('B5 asks about each site the report knows, and names it (UC-23)', async ({ page }) => {
  const reportId = await signedInWithReport(page, 'b5', [
    { name: 'Depozit', locality: 'Bălți' },
    { name: 'Atelier', locality: 'Orhei' },
  ]);
  const organizationId = organizationOf.get(reportId) ?? '';

  // **B1 first, because the rows are the report's answers and not the snapshot's alone** — opening
  // the step commits its shown defaults (FR-27, UX-34), which is task 91.2's rule and the reason
  // §7.2 calls the snapshot the default rather than the authority.
  await page.goto(`/reports/${reportId}/B1`);
  // **Waited on the STORE, not on the indicator** (found while writing task 36.7's B6 journey, which
  // has the same shape): *Salvat* is also what the indicator reads when nothing is pending, which is
  // its state on arrival — so a wait on it here passes before the defaults are queued, and B5 would
  // then be asserted against a report that had answered nothing. It happens to still pass, because
  // `answeredRows` folds the snapshot's rows in either way — which is exactly what makes the vacuous
  // wait dangerous rather than merely useless: it would let a regression in the *stored* half hide.
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({ organizationId, reportId, elementKey: 'CityOfSite' }))?.valueText,
      { timeout: 15_000 },
    )
    .toBe('Bălți');

  await page.goto(`/reports/${reportId}/B5`);

  // Each group's legend carries the position AND what the report calls the row. The position is
  // what §7.3 actually keys on — two sites in one city would both read *Bălți* — and the name is
  // what lets a reader tell one row from another at all. Before this task both read *Amplasament 1*
  // and there was only one of them.
  const balti = page.getByRole('group', { name: 'Amplasament 1 — Bălți' });
  const orhei = page.getByRole('group', { name: 'Amplasament 2 — Orhei' });
  await expect(balti).toBeVisible();
  await expect(orhei).toBeVisible();
  // Exactly two, so a third site nobody entered — or a group per element — fails here.
  //
  // **The pattern matches the legend's shape, not the word**, and that is precision rather than a
  // workaround: §6.2's anatomy gives every disclosure field `role="group"` too, and B5's own
  // element labels begin *"Amplasament situat…"* — so a bare `/^Amplasament /` resolves six.
  await expect(page.getByRole('group', { name: /^Amplasament \d+ — / })).toHaveCount(2);

  // UC-23's alternate flow is a **negative determination, not an empty section**: the reporter says
  // no rather than leaving the field blank, and the two are different answers in the store.
  const near = balti.getByRole('combobox', {
    name: 'Amplasament situat în apropierea unei zone sensibile din punctul de vedere al biodiversității',
  });
  await near.click();
  await page.getByRole('option', { name: 'Nu', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });

  // **Stored against the right site**, which the indicator cannot tell you — it reads *Salvat*
  // whichever ordinal was written, and a group that ignored its ordinal would look identical.
  const stored = {
    organizationId,
    reportId,
    elementKey: 'SiteLocatedNearABiodiversitySensitiveArea',
  };
  await expect
    .poll(async () => await disclosureValueOf({ ...stored, ordinal: 0 }), { timeout: 15_000 })
    .toMatchObject({ valueBoolean: false, state: 'ok' });
  // …and the other site is untouched, so *no for Bălți* has not been filed as *no for Orhei*.
  expect(await disclosureValueOf({ ...stored, ordinal: 1 })).toBeNull();
});

/**
 * B6 in a browser (UC-24, FR-24, FR-28, FR-29; task 36.7) — **the direction nothing proved.**
 *
 * B6 introduces no anatomy: four `numeric` elements, no axis, one admitted unit each, and a
 * sector-driven applicability rule task 91.3 registered and proved both ways at the api. So this
 * task is the *proof*, not the build — task 36.3's finding on B2, reached the same way. What no
 * test covered is B6 **applying**: the case below it asserts only that an untouched B1 leaves the
 * module ruled out, and a rule that had stopped applying to anyone would satisfy that perfectly.
 *
 * It is also the clearest thing in the suite about why the rule reads B1's *stored* answers rather
 * than the entity snapshot (§7.2): the entity is a bakery, and B6 is ruled out until B1 is opened
 * and its shown defaults are committed (FR-27, UX-34). The module arrives because the **report**
 * says the undertaking manufactures, not because the platform knew it.
 */
test('B6 applies once B1 says the undertaking manufactures, and asks in m³ (UC-24)', async ({
  page,
}) => {
  // **A site is what makes the fixture take a snapshot at all** (`seedReport` writes one only when
  // sites are given), and the snapshot is where B1's defaults come from — so without it there is no
  // activity code to commit and this journey would test nothing while looking like it passed.
  const reportId = await signedInWithReport(page, 'b6', [{ name: 'Brutăria', locality: 'Chișinău' }]);
  const organizationId = organizationOf.get(reportId) ?? '';
  const rail = page.getByRole('navigation', { name: 'Secțiunile raportului' });

  // Ruled out to begin with, on an entity whose snapshot already says `10.71` — bakery products,
  // four levels under the manufacturing section the rule names. Nothing is stored yet.
  await page.goto(`/reports/${reportId}/B6`);
  const b6 = rail.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'B6', exact: true }) });
  await expect(b6).toHaveText(/Nu se aplică/u);

  // Opening B1 commits its shown defaults, which is what turns the snapshot's activity code into
  // the report's own answer (§12.5.6, task 91.2).
  await page.goto(`/reports/${reportId}/B1`);
  // **Waited on the STORE, not on the indicator**, and the mechanism is worth naming because it is
  // not what it looks like: `saveStateOf` answers `SAVED` when nothing is pending **and** while a
  // write is pending inside UX-36's 250 ms anti-flicker budget. So `toHaveText(/Salvat/)` matches
  // on arrival, before the defaults are queued — the assertion below would then read a rail
  // rendered from a report that had answered nothing. It cost half an hour to find; the indicator
  // is right and the wait was vacuous.
  await expect
    .poll(
      async () =>
        (await disclosureValueOf({
          organizationId,
          reportId,
          elementKey: 'NaceSectorClassificationCodes',
        }))?.valueText,
      { timeout: 15_000 },
    )
    .toBe('nace:NACE_C1071');

  await page.goto(`/reports/${reportId}/B6`);
  await expect(b6).not.toHaveText(/Nu se aplică/u);

  // **UC-24's two steps, and there are four fields rather than the three it used to name.** The use
  // case was amended on 8 Sep 2026 against EFRAG's own package: its step 1 listed withdrawal, the
  // high-stress share and consumption, and `WaterDischargeFromUndertakingProductionProcesses` — the
  // figure between the last two — was named by neither it nor `design_spec.md` §6.1. The template's
  // own layout is the split now written into the use case: `B6 - Water Withdrawal` over the first
  // pair, `B6 - Water Consumption` over the second.
  //
  // Exactly four, so a rule that brought in a subset — or a module that grew one — fails here
  // rather than passing a check for the one field this case goes on to fill.
  for (const label of [
    'Cantitatea totală de apă prelevată de la toate amplasamentele',
    'Cantitatea de apă prelevată la amplasamentele situate în zone cu stres hidric ridicat',
    'Apele evacuate din procesele de producție ale întreprinderii',
    'Consumul total de apă',
  ]) {
    await expect(page.getByRole('group', { name: label })).toBeVisible();
  }
  // **Page-wide, and that is a measurement rather than laziness** (convention review, 8 Sep 2026,
  // which asked for it scoped). `WizardShell` renders `<div className={styles.main}>` — a CSS name,
  // not a `<main>` landmark — so there is nothing to scope to: `getByRole('main')` finds zero on
  // this screen, and four of the five archetype shells are the same. Measured here: the wizard
  // chrome contributes no textbox, so page-wide IS the step's fields today. What it gives up is
  // stated rather than hidden — a textbox added to the chrome would satisfy this count while
  // saying nothing about B6.
  await expect(page.getByRole('textbox')).toHaveCount(4);

  // **UX-14's first branch, which B4 never exercises**: `m3` is the only unit the taxonomy admits
  // here, so it is *shown* and never asked — a chooser over one option is a control that cannot
  // change anything. Rendered as its symbol, because `m3` is EFRAG's UTR code and an internal
  // identifier may not reach a reader.
  const consumption = page.getByRole('group', { name: 'Consumul total de apă' });
  await expect(consumption.getByText('m³', { exact: true })).toBeVisible();
  await expect(consumption.getByRole('combobox')).toHaveCount(0);

  const total = consumption.getByRole('textbox');
  await total.fill('1450');
  await total.blur();

  // **The poll is the barrier; there is no indicator wait above it** (convention review, 8 Sep
  // 2026). A blur does *not* make one non-vacuous, which is what this task first assumed:
  // `saveStateOf` answers `SAVED` while a write is pending inside UX-36's 250 ms budget as well as
  // when none is, so `toHaveText(/Salvat/)` matches at the instant of the blur. What makes the five
  // remaining waits in this file sound is the store poll after each of them, not the blur before.
  //
  // The figure carries its unit, which the indicator cannot tell you either: a fixed unit that
  // reached the screen and not the write would store 1450 of nothing.
  await expect
    .poll(
      async () =>
        await disclosureValueOf({ organizationId, reportId, elementKey: 'TotalWaterConsumption' }),
      { timeout: 15_000 },
    )
    .toMatchObject({ valueNumeric: '1450', unitCode: 'm3', state: 'ok' });
});

test('a module the rules ruled out says so on the rail rather than counting to zero (FR-28)', async ({
  page,
}) => {
  const reportId = await signedInWithReport(page, 'b1rules', [{ name: 'Hala', locality: 'Chișinău' }]);

  await page.goto(`/reports/${reportId}/B1`);
  const rail = page.getByRole('navigation', { name: 'Secțiunile raportului' });

  // **B6's own item**, not the first match on the rail: the test is named for B6, and a rail-wide
  // text locator would keep passing if B6's applicability broke while another module happened to
  // show the same words (convention review, 3 Sep 2026 — `.first()` is a finding, not a style).
  const b6 = rail.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'B6', exact: true }) });
  await expect(b6).toHaveText(/Nu se aplică/u);
  // And it is the only module in that state on an untouched B1, which is what makes the assertion
  // above about B6 rather than about the rail.
  await expect(rail.getByText('Nu se aplică')).toHaveCount(1);
});
