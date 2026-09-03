import type { DisclosureKind } from '@easyesg/vsme';
import type { PeriodType } from '@api/contracts/taxonomy-registry.port';
import type { EpochMillis } from '@api/contracts/types/time';
import type { ApplicabilityCondition } from './applicability.model';
import type { DisclosureState } from './disclosure-value.model';

/**
 * What the wizard is given (task 89; S-07, FR-24 … FR-32).
 *
 * **The server composes taxonomy, labels and stored values; the screen composes none of them.** S-07
 * describes step content as *"disclosure field labels, help text, values, units, state markers"* —
 * three sources that only this tier can join. `TAXONOMY_REGISTRY` and `DISCLOSURE_CATALOGUES` are
 * api-side (AD-3, and task 33.2's decision that label resolution is `apps/api`'s), and the values are
 * behind RLS. A browser given three of these and asked to join them would be a second implementation
 * of the pinning rule DR-4 exists to keep in one place.
 *
 * **Everything here is resolved against the report's OWN pinned version**, never the newest
 * registered one. That is the whole of DR-4 restated at the read boundary: a report authored under
 * `2026-02-01` must render that version's elements years after `2026-05-01` is adopted, and task
 * 33.3 registered a second version precisely so this is exercised rather than asserted.
 */

/**
 * One B1 element an applicability rule reads, with its wording (task 91.3).
 *
 * The key is identity and the label is what the announcement says: UX-27 requires the cause to be
 * *named*, and `NumberOfEmployees` is a taxonomy element key, which no reader may be shown.
 */
export interface ApplicabilityDriver {
  readonly elementKey: string;
  /** The element's wording in the request's locale; `null` where the catalogue names none. */
  readonly label: string | null;
}

/**
 * Why a field or a module does or does not apply — UX-27's cause, as data the screen words
 * (task 91.3; FR-28).
 *
 * **No sentence is composed here.** The reader is an SME owner or a bookkeeper, the wording is a
 * catalogue key in the browser, and what crosses the wire is the condition, who it read and what
 * they answered.
 */
export interface DisclosureApplicabilityCause {
  readonly condition: ApplicabilityCondition;
  /** The B1 elements whose answers decide it — one for a threshold, five for the site rule. */
  readonly drivers: readonly ApplicabilityDriver[];
  /** A `numeric_at_least` threshold as decimal text (NFR-58); `null` for the other conditions. */
  readonly threshold: string | null;
  /**
   * What the reporter answered, as the store holds it. **`null` where the deciding field is
   * unanswered** — the state every conditional field is in before B1 is filled in — or where the
   * condition has no single answer to quote, which is the site rule.
   */
  readonly answer: string | null;
}

/**
 * One module as the persistent list shows it (UX-5).
 *
 * **Counts rather than a computed status**, because a *status* is a judgement and FR-40's validation
 * verdicts are task 40's. What a module can honestly report before a validation engine exists is how
 * many of its fields have been answered — and `answered` counts a stored row in any of the answered
 * states, including FR-30's nil return and FR-32's not-available, because a considered non-answer is
 * an answer. That distinction is why this is not `SELECT count(*) WHERE value IS NOT NULL`.
 */
export interface DisclosureModuleSummary {
  /** `B1` … `B11`, `C1` … `C9` — the standard's own module, from the taxonomy's presentation roles. */
  readonly module: string;
  readonly answered: number;
  readonly total: number;
  /**
   * When this module's most recent answer was stored — epoch milliseconds — or `null` where nothing
   * in it has been answered (task 35.3; UC-36, FR-39). **Position is where work last happened**:
   * the module with the latest value is where a returning reporter is put, on any device, and
   * nothing records anyone's position separately — the values already carry it. `updated_at` is
   * the store's own column, so this is derived rather than written.
   */
  readonly lastAnsweredAt: EpochMillis | null;
  /**
   * Whether the module has anything to answer at all (task 91.3; FR-28, UX-9).
   *
   * **True while any one of its elements applies** — so B8 stays applicable at 40 employees, where
   * only its turnover rate has gone, and B6 goes whole because one rule governs all four of its
   * elements. `answered` and `total` above count applicable elements only: a services company that
   * can never fill B6 must not be shown a denominator it cannot reach.
   */
  readonly applicable: boolean;
  /**
   * The cause, where the module is inapplicable and its elements agree on one; `null` otherwise.
   *
   * Agreement is the condition rather than a formality: naming one of two reasons a module vanished
   * would be a wrong announcement, and UX-27 asks for the cause, not for a cause.
   */
  readonly applicabilityCause: DisclosureApplicabilityCause | null;
}

/**
 * One answer a choice field offers (task 91.1).
 *
 * `value` is the member's **taxonomy-qualified** name — `vsme:IndividualMember`, `nace:NACE_A0111`,
 * `country:MD` — for identity: two taxonomies can declare the same local name, and a stored
 * `IndividualMember` alone names nothing once it has left the domain it was offered in. It is also
 * XBRL's own serialisation of an enumeration fact (a Phase 2 export, FR-176); the Excel Digital
 * Template's dropdowns take the template's own values, and mapping to them is task 46's. An
 * `enumeration_set` stores its chosen values space-separated.
 */
export interface DisclosureOption {
  readonly value: string;
  readonly label: string | null;
  /** The classification's own code where it has one — `01.11` for a NACE class — for a picker. */
  readonly code: string | null;
}

/**
 * What a field would hold if the reporter accepted what the platform already knows (task 91.2;
 * FR-27, UX-109). The value columns and nothing else — the field already carries the key, so
 * committing a default is one write of `{ ...key, ...defaultValue, state: ok }`, which is how the
 * client makes it an answer on blur or step change (UX-34; §12.5.6, task 91.2's row).
 */
export interface DisclosureDefault {
  readonly valueNumeric: string | null;
  readonly valueText: string | null;
  readonly valueBoolean: boolean | null;
  readonly valueDate: string | null;
}

/** One answerable field: its shape from the taxonomy, its wording from the catalogue, its value from the store. */
export interface DisclosureField {
  readonly elementKey: string;
  /** An axis member, or `''` where the element is undimensioned — §7.3's convention. */
  readonly dimensionKey: string;
  readonly ordinal: number;
  readonly kind: DisclosureKind;
  readonly periodType: PeriodType;
  /** The axes this element is dimensioned along; empty for the 109 that are not. */
  readonly axes: readonly string[];
  /**
   * Whether this field is one **row of a repeating group** — an element on a *typed* axis, whose
   * rows are sites, subsidiaries or materials the reporter adds (task 36.2; §7.3).
   *
   * **The screen cannot derive it, and a plausible guess is wrong.** `axes` alone does not say
   * whether a dimension takes an arbitrary identifier or a member of a fixed domain, and "several
   * elements share an axis" — the only other signal on the wire — holds for four *explicit* axes at
   * `2026-05-01` (energy breakdown, reporting scopes, pollutants, waste types), which would offer to
   * add a pollutant row to a fixed classification. Whether an axis is typed is the registry's
   * answer, and this is it, resolved once per axis rather than once per field.
   */
  readonly repeating: boolean;
  /** The presentation order EFRAG gives it, so a step renders as the standard reads. */
  readonly order: number;
  /** `null` where the pinned version's catalogue names no label — logged, and rendered as absent. */
  readonly label: string | null;
  /**
   * Whether that wording is EFRAG's own or this platform's (NFR-24, task 33.2). Carried per field
   * rather than per step because it travels with the text: a screen that renders a label without its
   * standing cannot make UX-47's statement, and of this product's three locales only English is
   * official.
   */
  readonly labelStanding: string | null;
  /**
   * EFRAG's `documentation` label for the element, in the request's locale, or `null` where the
   * package carries none — which is the ordinary case (task 91.1; UX-17, OQ-59). Its standing is
   * the label's, and `labelStanding` already carries it.
   */
  readonly help: string | null;
  /**
   * The answers a choice field offers, for `enumeration` and `enumeration_set` kinds; `null` for
   * every other kind (task 91.1). Each `value` is the member's taxonomy-qualified name — what the
   * store holds and the export emits — and `label` its wording in the request's locale, `null`
   * where none is held (ISO 3166 members, whose names the browser resolves from its own catalogue).
   */
  readonly options: readonly DisclosureOption[] | null;
  /**
   * The entity record's answer where the store holds none (task 91.2; FR-27, D-2). **`null` the
   * moment a row exists for this key, in any state** — a field the reporter cleared is a decision,
   * not an invitation to re-fill — and `null` on every field the platform cannot answer, which is
   * most of them. Distinguishable from a stored value by construction: it is a different property,
   * and the value columns beside it stay `null` until something is written.
   */
  readonly defaultValue: DisclosureDefault | null;
  readonly valueNumeric: string | null;
  readonly valueText: string | null;
  readonly valueBoolean: boolean | null;
  readonly valueDate: string | null;
  readonly unitCode: string | null;
  readonly state: DisclosureState;
  /** FR-32's reason, required exactly when the state is `not_available`. */
  readonly notAvailableReason: string | null;
  /** FR-47: this value was carried forward from the prior period and is marked for review. */
  readonly carriedForward: boolean;
  /**
   * Whether this field applies to this reporter (task 91.3; FR-28, BR-APP-5).
   *
   * **`false` does not mean empty.** UX-28 requires a value entered before the condition turned to
   * be retained and the reporter told so, so the value columns above are served exactly as stored —
   * a retained answer is `applicable: false` beside a `state` that is not `missing`, and that pair
   * is the whole of the retention signal.
   */
  readonly applicable: boolean;
  /** Why, for the fields a rule governs; `null` for the ones no rule names, which is most. */
  readonly applicabilityCause: DisclosureApplicabilityCause | null;
}

/** One wizard step: a module, and the fields the pinned taxonomy puts in it, in its order. */
export interface DisclosureStep {
  readonly module: string;
  readonly taxonomyVersion: string;
  readonly fields: readonly DisclosureField[];
}
