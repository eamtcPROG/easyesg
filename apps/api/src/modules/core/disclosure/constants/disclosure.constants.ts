/**
 * The configuration-store `kind`s `core/disclosure` reads (AD-4, DR-3).
 *
 * Underscores because the seed loader turns a filename's dashes into them —
 * `config/seed/disclosure-applicability.vsme.json` publishes under `disclosure_applicability`.
 * Getting it wrong is silent: the entry is simply never found.
 */

/**
 * FR-28's conditional-applicability rules (FR-72, task 91.3). **Scope is the standard**, on
 * `reporting_taxonomy`'s precedent: 50 and 150 are VSME's own numbers, and what transposing
 * legislation moves is carried by the store's own effective dating rather than by a second scope.
 */
export const DISCLOSURE_APPLICABILITY_CONFIG_KIND = 'disclosure_applicability';

/**
 * Which explicit axes are **breakdowns** rather than classifications (task 36.4).
 *
 * An explicit axis says an element is reported along a fixed domain, and says nothing about how a
 * reporter answers it. Two shapes hide behind that one word, and rendering them alike is wrong in
 * both directions:
 *
 * - a **breakdown** is answered for every member — B3's energy consumption is renewable,
 *   non-renewable and the total of the two, and a reporter fills all three;
 * - a **classification** is a domain the reporter selects from — B4's 94 pollutants, B7's 973 waste
 *   categories, B8's 256 countries. One row per member there is 282 fields on a screen that should
 *   be asking *which of these do you emit*.
 *
 * **Nothing in EFRAG's package distinguishes them**, which is why this is data rather than a
 * derivation: member count is an invented threshold, and reading the default member's English words
 * is not a rule. Registering it as configuration is AD-4 read literally — the decision is per axis,
 * reviewable, effective-dated, and adding one needs no redeploy (DR-3), exactly as
 * `disclosure_applicability` registers FR-28's conditions.
 *
 * **Seeded with one breakdown and three classifications**: `BreakdownOfEnergyConsumptionAxis` is the
 * breakdown, and `TypeOfPollutantAxis` (36.5), `TypeOfWasteAxis` (36.8) and
 * `CountryOfEmploymentContractAxis` (36.9) are classifications. This sentence read *"seeded with the
 * energy axis alone"* until 9 Sep 2026 and had been wrong since 36.5 — prose about a file's contents,
 * which no gate reads.
 *
 * **`ReportingScopesAxis` is the interesting omission, and B3 reaches it** (amended 8 Sep 2026,
 * same task). Its members are `BaselineYearMember`, `TargetYearMember` and `CurrentlyStatedMember`
 * — *which year's figure*, not which scope, despite the name — so it is C3's reduction-target
 * framing of the eight emissions disclosures B3 shares with it. On B3 the reporter states the
 * current figure, which is the axis's own default member, and one undimensioned row is the right
 * screen. Leaving it unregistered is therefore a decision that happens to agree with the
 * fail-closed default rather than an omission the default is covering for, and registering it is
 * task 79.x's, where baseline and target *are* rows a Comprehensive reporter fills.
 */
export const DISCLOSURE_AXIS_SHAPE_CONFIG_KIND = 'disclosure_axis_shape';

/**
 * Which Basic-module figures the platform derives, and from what (task 36.10).
 *
 * **Data because the offers are thresholds that vary by jurisdiction** — EFRAG prints 2 000 hours
 * for a full-time working year and says in the cell that it *"may vary by country or sector,
 * depending on national rules or collective bargaining agreements"*, which for a product serving
 * Moldovan SMEs is a real difference rather than a formality. The *arithmetic* is not here: it is a
 * named formula in `models/derivation.model.ts`, because a formula belongs to a template version
 * and DR-4 pins one per report already (AD-4, and §12.5.6's task-36.10 rows).
 *
 * Seeded with the two the Digital Template 1.3.0 computes: B8's `EmployeeTurnoverRate` and B9's
 * `RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod`. An element named by no derivation is
 * an ordinary field the reporter answers, which is every other one.
 */
export const DISCLOSURE_DERIVATION_CONFIG_KIND = 'disclosure_derivation';

/**
 * The answers EFRAG's Digital Template ships a field already holding (task 36.11).
 *
 * **Data rather than a branch, because it is standard content** (AD-4, DR-3): a value the template
 * prints in a cell is EFRAG's, changes when the template changes, and a `if (elementKey === …)` in
 * the api would put it in a release. Measured before building it — every constant in the four
 * disclosure sheets' answer column — the Basic module ships **one**: B10's minimum-wage affirmation
 * at `D147`. B9's 2 000 hours is the other, and it is not here: that one is an *offer* the reporter
 * may accept without it becoming their answer, which is `disclosure-derivation.vsme.json`'s
 * `default`. The Comprehensive module's C6/C7 sheets carry thirteen more for task 79.x.
 *
 * **A template default is committed, and that is the whole difference from an offer.** It arrives
 * through task 91.2's `DisclosureDefault` and the wizard's existing outstanding-defaults commit, so
 * it becomes a stored answer with `origin = 'reported'` — the reporter is answering, by not
 * disagreeing. The project owner chose this over leaving it blank on 9 Sep 2026 with the cost
 * stated: a reporter who never opens B10 files a positive claim about legal compliance.
 *
 * **The entity snapshot outranks it** where both name an element, which none do today: a fact about
 * *this* undertaking beats an assumption the template makes about every undertaking.
 */
export const DISCLOSURE_TEMPLATE_DEFAULT_CONFIG_KIND = 'disclosure_template_default';
