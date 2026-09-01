/**
 * One stored answer to one VSME disclosure (task 34.1; §7.3, AD-3, FR-24 … FR-32).
 *
 * **The domain model of a generic store is deliberately thin.** T-3 accepts that this table gives up
 * compile-time typing, so nothing here pretends an `EnergyConsumptionFromFuels` row is a different
 * type from a `NumberOfEmployees` row — task 34.2's generated facade is where that is bought back,
 * from the taxonomy rather than from hand-written unions.
 */

/**
 * What a stored value *is*, beyond its contents — **FR-40's five validation states**, plus FR-30,
 * FR-31 and FR-32/D-4's three that are answers rather than verdicts.
 *
 * The three that are not failures matter most, and each is distinct from an absent row: a **nil
 * return** is an answered zero, **not material** is a considered exclusion, and **not available**
 * is a deliberate non-answer that must carry its reason. The reference reports this project reviewed
 * all disclose their gaps explicitly rather than hiding them, and a model that could only say
 * "present" or "absent" would force a reporter to lie by omission.
 *
 * Mirrors `report_disclosure_value_state_known` in the migration, which is the database's own copy.
 */
export const DISCLOSURE_STATE = {
  /** Answered, and the answer passes validation. */
  OK: 'ok',
  /** Applicable and unanswered — the state a new report's fields start in. */
  MISSING: 'missing',
  /** Answered, but inconsistent with another disclosure — FR-40's `VALUE INCONSISTENCY`. */
  INCONSISTENCY: 'inconsistency',
  /** Answered with something the element cannot hold. */
  ERROR: 'error',
  /** A URL-typed disclosure whose value is not reachable or not a URL — FR-40's `INVALID URL`. */
  INVALID_URL: 'invalid_url',
  /** Deliberately unanswered, with a reason the reader sees (FR-32, D-4). */
  NOT_AVAILABLE: 'not_available',
  /** Considered and excluded as not material (FR-31; its rationale is section-scoped — see below). */
  NOT_MATERIAL: 'not_material',
  /** Answered zero, which is an answer (FR-30). */
  NIL_RETURN: 'nil_return',
} as const;

export type DisclosureState = (typeof DISCLOSURE_STATE)[keyof typeof DISCLOSURE_STATE];

/**
 * The state a field holds before anyone answers it.
 *
 * Beside the vocabulary rather than at the call site, per CLAUDE.md: a default *is* a statement
 * about the set, and a copy in the repository and another in the wizard is how the two come to
 * disagree about what an untouched field means.
 */
export const DEFAULT_DISCLOSURE_STATE = DISCLOSURE_STATE.MISSING;

/**
 * What identifies a value within a report — the natural key, and a `UNIQUE` in the schema.
 *
 * **A single object rather than four parameters**, and this is the signature CLAUDE.md's rule was
 * written for: `element_key` and `dimension_key` are both `string` and adjacent, so a swapped call
 * compiles and reads a dimension member as an element. It would answer `null` rather than throw,
 * which every caller reads as "not answered yet".
 */
export interface DisclosureValueKey {
  readonly reportId: string;
  /** A VSME XBRL element local name, e.g. `EnergyConsumptionFromFuels`. */
  readonly elementKey: string;
  /** An axis member, or `''` where the element is undimensioned. Never null — see §7.3. */
  readonly dimensionKey: string;
  /** Position within a repeating group: sites, subsidiaries, materials. `0` where there is none. */
  readonly ordinal: number;
}

/**
 * The contents of one answer.
 *
 * **Four typed columns rather than one `jsonb`**, which is what makes a numeric disclosure summable
 * in SQL and a date comparable across periods (FR-45's comparatives, task 34.3's prior-period read).
 * Exactly one is expected to be set for a given element, and *which* one is the taxonomy's business
 * rather than this type's — `DisclosureKind` on `TaxonomyElement` is the authority, and task 34.2's
 * facade is what makes the pairing unrepresentable instead of merely wrong.
 */
export interface DisclosureValueContents {
  /** `numeric`, never float — these are summed into figures a filing carries. */
  readonly valueNumeric: string | null;
  readonly valueText: string | null;
  readonly valueBoolean: boolean | null;
  /** A calendar date as `YYYY-MM-DD`, never a JS `Date` — see the repository's `::text` note. */
  readonly valueDate: string | null;
  /** MWh, tCO2e, m3, headcount, FTE — validated against the element's own admitted units. */
  readonly unitCode: string | null;
  readonly state: DisclosureState;
  /**
   * Required exactly when `state` is `not_available`, enforced by a `CHECK` (FR-32, D-4).
   *
   * **FR-31's not-material rationale is deliberately NOT this column**, and where it lives is
   * unsettled: FR-31 declares a *section* not material with a recorded rationale (UC-30 marks a
   * module), so a per-field column is the wrong shape for it. Recorded in §12.5.6 rather than
   * decided here — see task 40, which owns the validation surface FR-31 satisfies.
   */
  readonly notAvailableReason: string | null;
  /**
   * FR-47: carried forward from the prior period and **marked**, "so that it is reviewed rather
   * than accumulating unnoticed". FR-46 is the neighbouring requirement — displaying last year's
   * value beside this year's input — and is task 34.3's, not this column's.
   */
  readonly carriedForward: boolean;
}

/** A stored value, as read back. */
export interface DisclosureValue extends DisclosureValueKey, DisclosureValueContents {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A value to write. The key says which field; the contents say what it now holds. */
export interface DisclosureValueWrite {
  readonly key: DisclosureValueKey;
  readonly contents: DisclosureValueContents;
}
