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
 * **Seeded with the energy axis alone.** B4's pollutants are task 36.5's decision; listing them
 * here now would be deciding how that screen works before anyone has designed it.
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
