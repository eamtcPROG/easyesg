/**
 * Conditional applicability (task 91.3; FR-28, FR-72, BR-APP-1 … BR-APP-5).
 *
 * **A rule says what makes a field apply, never what makes it disappear.** An element no rule names
 * is applicable, always — so the artefact holds four rules rather than a verdict per element, and a
 * taxonomy version that adds a hundred elements needs no line in it.
 *
 * **The rules are configuration, not code** (AD-4, DR-3, FR-72): `config/seed/disclosure-
 * applicability.vsme.json`, effective-dated in task 16's store, so a threshold that moves with the
 * standard or with Moldova's transposing legislation lands as a publish and reverts in one step.
 * They are evaluated by the api rather than by the wizard because only this tier holds the stored
 * B1 answers and the store — and because UX-27's announcement needs the *cause*, not the outcome.
 */

/**
 * How a rule decides — the three shapes FR-28's four rules take.
 *
 * `numeric_at_least` carries both thresholds (BR-APP-1's 50, BR-APP-2's 150); `any_row_answered` is
 * BR-APP-3's site-driven biodiversity; `member_within` is BR-APP-4's sector-driven water. Declared
 * once, as every closed vocabulary here is, so a reader branches on a member and never on a
 * spelling of one.
 */
export const APPLICABILITY_CONDITION = {
  /** The driver's stored number is at least `threshold`. */
  NUMERIC_AT_LEAST: 'numeric_at_least',
  /** Any of the driver elements has at least one answered row — B1's sites. */
  ANY_ROW_ANSWERED: 'any_row_answered',
  /** The driver's stored member is one of `members`, or descends from one. */
  MEMBER_WITHIN: 'member_within',
} as const;

export type ApplicabilityCondition =
  (typeof APPLICABILITY_CONDITION)[keyof typeof APPLICABILITY_CONDITION];

/** BR-APP-1 and BR-APP-2: a headcount threshold. `threshold` is decimal text, never a float (NFR-58). */
export interface NumericAtLeastCondition {
  readonly kind: typeof APPLICABILITY_CONDITION.NUMERIC_AT_LEAST;
  readonly elementKey: string;
  readonly threshold: string;
}

/**
 * BR-APP-3: the report lists at least one site.
 *
 * **Several driver elements, not one nominated field.** A site row carrying only a GPS fix is a
 * site, so naming `AddressOfSite` alone would make an address the definition of one — the reason
 * §12.5.6's task-91.3 row gives for the plural.
 */
export interface AnyRowAnsweredCondition {
  readonly kind: typeof APPLICABILITY_CONDITION.ANY_ROW_ANSWERED;
  readonly elementKeys: readonly string[];
}

/**
 * BR-APP-4: the reported activity is one of the listed members, or descends from one.
 *
 * `members` are **taxonomy-qualified** (`nace:NACE_C`), the form a stored enumeration answer takes
 * (task 91.1), and descent is walked through the classification's own `parent` — a stored class
 * `nace:NACE_C1071` satisfies a rule naming the section `nace:NACE_C`.
 */
export interface MemberWithinCondition {
  readonly kind: typeof APPLICABILITY_CONDITION.MEMBER_WITHIN;
  readonly elementKey: string;
  readonly members: readonly string[];
}

export type ApplicabilityConditionSpec =
  | NumericAtLeastCondition
  | AnyRowAnsweredCondition
  | MemberWithinCondition;

/** One rule: the elements it governs, and what has to hold for them to apply. */
export interface ApplicabilityRule {
  readonly elements: readonly string[];
  readonly condition: ApplicabilityConditionSpec;
}

/**
 * Why a field does or does not apply — UX-27's *"brief explanation naming the B1 answer that caused
 * it"*, as data the screen words.
 *
 * Nothing here is a sentence, and that is the user-facing-text rule rather than an omission: the
 * reader is an SME owner, `NumberOfEmployees` means nothing to them, and the wording is a catalogue
 * key resolved in the browser from `condition` plus the values below.
 */
export interface ApplicabilityCause {
  readonly condition: ApplicabilityCondition;
  /** The B1 elements whose answers decide it — one for a threshold, five for the site rule. */
  readonly driverKeys: readonly string[];
  /** `numeric_at_least`'s value as decimal text; `null` for the other two conditions. */
  readonly threshold: string | null;
  /**
   * What the reporter answered, as the store holds it — `'40'`, or a space-separated member set.
   *
   * **`null` means no figure to quote**, which covers three cases the reader treats alike because
   * the rule cannot be evaluated in any of them: the deciding field is unanswered — the state every
   * conditional field is in until its own driver is answered (§12.5.6's task-91.3 row; UX-9's
   * *completed* gates module navigation, which is the wizard's, at a coarser grain) — it was
   * answered with something carrying no value of that kind, such as FR-32's not-available, or the
   * condition has no single answer, which is the site rule. `applicable` is what separates them
   * where it matters: for the site rule, true with no answer means the report lists sites.
   */
  readonly answer: string | null;
}

/** A rule's verdict for one element, before any wording is joined to it. */
export interface EvaluatedApplicability {
  readonly applicable: boolean;
  readonly cause: ApplicabilityCause;
}
