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
  // is the fact (NFR-56).
  // The indicator by its region, not by its words: *"Salvat"* also appears inside the exit link's
  // own sentence — *"lucrul este salvat"* — and a text locator matches both (found by strict mode,
  // 3 Sep 2026). UX-35 puts the state in one fixed location, and this is that location.
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });
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
  await expect(page.getByRole('status', { name: 'Starea salvării' })).toHaveText(/Salvat/u, {
    timeout: 15_000,
  });

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
