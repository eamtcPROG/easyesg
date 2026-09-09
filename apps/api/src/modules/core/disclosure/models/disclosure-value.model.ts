/**
 * One stored answer to one VSME disclosure (task 34.1; §7.3, AD-3, FR-24 … FR-32).
 *
 * **The domain model of a generic store is deliberately thin.** T-3 accepts that this table gives up
 * compile-time typing, so nothing here pretends an `EnergyConsumptionFromFuels` row is a different
 * type from a `NumberOfEmployees` row — task 34.2's generated facade is where that is bought back,
 * from the taxonomy rather than from hand-written unions.
 */

/**
 * Where a value came from — the `report_disclosure_value_origin_known` CHECK's vocabulary
 * (task 36.4).
 *
 * UC-21's alternate flow is the reason it exists: B3's quantitative figures are *"normally produced
 * by the carbon calculator (UC-33) rather than typed directly"*, and a reporter looking at a filled
 * field cannot otherwise tell which happened. UX-12's provenance and UX-43's override marker both
 * rest on the distinction — a trace can only be offered for a figure the system computed.
 *
 * **Three members and one reachable**, stated rather than left to be discovered, exactly as
 * `REPORT_STATUS` states its four. `CALCULATED` arrives with task 39.2's return from the
 * calculator and `OVERRIDDEN` with task 38.5's UC-34; the migration's own header carries why the
 * `CHECK` declares all three now.
 */
export const DISCLOSURE_ORIGIN = {
  /** The reporter entered it. Every row today, and the column's default. */
  REPORTED: 'reported',
  /** The carbon calculator produced it (UC-33; task 39.2 writes it). */
  CALCULATED: 'calculated',
  /** A reporter replaced a computed figure, with a reason (UC-34; task 38.5 writes it). */
  OVERRIDDEN: 'overridden',
} as const;

export type DisclosureOrigin = (typeof DISCLOSURE_ORIGIN)[keyof typeof DISCLOSURE_ORIGIN];

/**
 * What a row with no recorded provenance is — the `report_disclosure_value.origin` column's own
 * `DEFAULT`, mirrored here rather than restated at each reader.
 *
 * Beside the vocabulary because it is an operation over it (root `CLAUDE.md`: *"an operation over a
 * vocabulary lives with the vocabulary, not with each caller"*). A step read serving a field with no
 * stored row must still answer an origin, and `?? DISCLOSURE_ORIGIN.REPORTED` written at that call
 * site is a second place the column's default is true — which is the thing that drifts when 39.2
 * makes `CALCULATED` reachable and someone changes one of the two.
 */
export const DEFAULT_DISCLOSURE_ORIGIN: DisclosureOrigin = DISCLOSURE_ORIGIN.REPORTED;

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
 * Has this field been answered? **`missing` is the only state that is not an answer.**
 *
 * FR-30's nil return is an answered zero, FR-31's not-material is a considered exclusion and
 * FR-32's not-available is a deliberate non-answer carrying a reason — counting any of them as
 * unanswered would tell a reporter they still have work on a field they have already decided.
 *
 * Beside the vocabulary rather than at each caller (CLAUDE.md): the module list counts with it and
 * task 91.3's site rule asks the same question of B1's rows, and two copies of *what an answer is*
 * is how a progress count and an applicability verdict come to disagree.
 */
export const isAnsweredState = (state: DisclosureState | undefined): boolean =>
  state !== undefined && state !== DISCLOSURE_STATE.MISSING;

/**
 * FR-30, as one function: **an answered numeric zero is a nil return, and anything else is `ok`.**
 *
 * *"The system shall record a nil or zero return as an affirmative disclosure, stored and rendered
 * distinctly from an unanswered field."* `NIL_RETURN` has been in this vocabulary, in the migration's
 * `CHECK` and in the wizard's tone map since task 34.1, and **nothing ever wrote one** — so P3's
 * *"a gap is an answer"* was true of the schema and false of the product until task 36.10.
 *
 * **Derived from the value rather than taken from the caller** (P-4). A browser that sent `ok` for a
 * zero would be deciding a disclosure's meaning, and the two would then disagree the first time
 * anything else wrote a value — the calculator, an import, the derivation beside this. It also
 * settles the reverse, which a one-way rule would leave: a field edited from 0 to 5 must stop being
 * a nil return, and a client that remembered to set the state on the way in has no reason to
 * remember on the way back out.
 *
 * **Only these two states are its business.** A deliberate non-answer keeps its own meaning —
 * `not_available` carries FR-32's reason, `not_material` is FR-31's exclusion — and FR-40's three
 * validation verdicts are a run's conclusion about a value, not a property of it. Passing those
 * through untouched is what keeps this from being a second, quieter, validation rule.
 *
 * Where it binds is **every numeric kind, not B9's fields**: a zero means the same thing in B4 as in
 * B9, and a per-module rule would be the per-screen divergence UX-89 exists to prevent. B9 and B11
 * are merely where a reader most needs it — *no fatalities* and *no corruption incidents* are
 * exactly the disclosures that must not read as unanswered (UC-27, UC-29).
 */
export const answeredState = (contents: {
  readonly valueNumeric: string | null;
  readonly state: DisclosureState;
}): DisclosureState => {
  if (contents.state !== DISCLOSURE_STATE.OK && contents.state !== DISCLOSURE_STATE.NIL_RETURN) {
    return contents.state;
  }
  if (contents.valueNumeric === null || contents.valueNumeric.trim() === '') return contents.state;
  const parsed = Number(contents.valueNumeric);
  // A value that does not parse is not a zero and is not this function's problem — the column is
  // `numeric` and the database refuses it, which is the layer that should.
  if (!Number.isFinite(parsed)) return contents.state;
  return parsed === 0 ? DISCLOSURE_STATE.NIL_RETURN : DISCLOSURE_STATE.OK;
};

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
  /**
   * Where this value came from (task 36.4) — **on the read shape and deliberately not on
   * `DisclosureValueContents`**, which is what a caller writes.
   *
   * Nothing in the application can decide it yet: the column defaults to `reported`, and the two
   * members that are not the default arrive with the tasks that produce them — 39.2's calculator
   * return and 38.5's override. Putting it on the write shape would oblige every caller to supply
   * a value only those tasks can know, and `wizard.controller.ts` would be sending `'reported'` on
   * every keystroke as though it had chosen. **The read tells; the write cannot.**
   */
  readonly origin: DisclosureOrigin;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** A value to write. The key says which field; the contents say what it now holds. */
export interface DisclosureValueWrite {
  readonly key: DisclosureValueKey;
  readonly contents: DisclosureValueContents;
}
