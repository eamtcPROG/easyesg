import { VERDICT, type Verdict } from './verdict.js';

/**
 * What a validation rule **is** as data (task 40.1; FR-73, `architecture.md` §9.8) — the shape task 41.1 stores as
 * effective-dated configuration and A-05 edits (task 67.8).
 *
 * **A closed vocabulary of eight kinds** (§12.5.6's task-40 row (1)), each a check EFRAG's own Digital Template makes —
 * its validation sheet and the status column beside each disclosure were profiled to find them. **A new rule is data;
 * a new kind is code.** That is the line the task row asked for between *too narrow* (every rule needing code) and
 * *too loose* (the interpreter becoming a language A-05 would need an expression editor for). Applicability is not a
 * kind: it is a shape of the form, evaluated from its own artefact before any rule runs (§9.8, FR-28), and reaches the
 * interpreter as the scope it evaluates over.
 */
export const RULE_KIND = {
  /** Each field it names is answered — optionally only when another answer holds. Presence. */
  REQUIRED: 'required',
  /** At least one of the fields it names is answered. Presence. */
  REQUIRED_ANY: 'required_any',
  /** A row of a list, once started, is finished: every element it names answered at that member or position. */
  ROW_COMPLETE: 'row_complete',
  /** Weighted parts against a total — equal, at most or at least. Consistency, the calculation linkbase's shape. */
  SUM: 'sum',
  /** A number within an inclusive minimum and maximum; non-negativity is a minimum of zero. Range. */
  RANGE: 'range',
  /** The address is absolute: an `http` or `https` scheme and a host (FR-40; 182/25). Format. */
  URL: 'url',
  /** An answer that leaves other elements empty — a disclosure published elsewhere and the same table filled in. */
  EXCLUSIVE: 'exclusive',
  /** A movement beyond one global proportion against the comparable prior value (FR-46; 182/28). Cross-period. */
  YEAR_OVER_YEAR: 'year_over_year',
} as const;

export type RuleKind = (typeof RULE_KIND)[keyof typeof RULE_KIND];

/**
 * The verdicts each kind may fire — **every rule names its own**, from this list (§12.5.6's task-40 row (2)), because
 * the template varies it within one kind: a gender split short of headcount is `MISSING VALUE`, an energy split over
 * its total `VALUE INCONSISTENCY`. Only `sum` has a choice today; the rest are a list of one so A-05 edits every rule
 * the same way, and widening a kind is one line here.
 */
export const ADMITTED_VERDICTS = {
  [RULE_KIND.REQUIRED]: [VERDICT.MISSING_VALUE],
  [RULE_KIND.REQUIRED_ANY]: [VERDICT.MISSING_VALUE],
  [RULE_KIND.ROW_COMPLETE]: [VERDICT.MISSING_VALUE],
  [RULE_KIND.SUM]: [VERDICT.MISSING_VALUE, VERDICT.VALUE_INCONSISTENCY],
  [RULE_KIND.RANGE]: [VERDICT.ERROR],
  [RULE_KIND.URL]: [VERDICT.INVALID_URL],
  [RULE_KIND.EXCLUSIVE]: [VERDICT.VALUE_INCONSISTENCY],
  [RULE_KIND.YEAR_OVER_YEAR]: [VERDICT.VALUE_INCONSISTENCY],
} as const satisfies Record<RuleKind, readonly Verdict[]>;

type VerdictOf<K extends RuleKind> = (typeof ADMITTED_VERDICTS)[K][number];

/** How a `sum` rule's weighted parts stand to its total — the template checks all three. */
export const RELATION = {
  /** The parts are the total: B8's gender split against its headcount. */
  EQUAL: 'equal',
  /** The parts do not exceed it: B3's energy split against its total consumption. */
  AT_MOST: 'at_most',
  /** The parts reach it: B8's split by country against its headcount. */
  AT_LEAST: 'at_least',
} as const;

export type Relation = (typeof RELATION)[keyof typeof RELATION];

/** What must hold for a conditional rule to apply — a closed set, so a condition is never an expression. */
export const CONDITION_KIND = {
  /** The element holds a value: content or a nil return. A declaration of not available gives none. */
  ANSWERED: 'answered',
  /** A yes/no element is answered yes — B4's link is required only when the disclosure is public. */
  IS_TRUE: 'is_true',
} as const;

export type ConditionKind = (typeof CONDITION_KIND)[keyof typeof CONDITION_KIND];

export interface Condition {
  readonly kind: ConditionKind;
  readonly element: string;
}

/**
 * A field a rule names: an element, and optionally one member of its axis. **With no member it means every row the
 * element holds** — each member of a breakdown or classification, each position of a list — which is what a rule over
 * a whole list wants. A breakdown stores its total as a member of its own (B3's
 * `TotalRenewableAndNonRenewableEnergyMember`), so a sum over a breakdown names its members.
 */
export interface FieldSelector {
  readonly element: string;
  readonly member?: string;
}

/** A part of a total, with the calculation linkbase's weight — `1` unless stated, `-1` for a part subtracted. */
export interface SumPart extends FieldSelector {
  readonly weight?: string;
}

interface RuleCore<K extends RuleKind> {
  /** Stable within a set: a finding names its rule by it, and A-05 edits a rule by it. */
  readonly id: string;
  readonly kind: K;
  readonly verdict: VerdictOf<K>;
  /** A catalogue key — the wording ships with the release, never in the rule (OQ-43; FR-73 item 3). */
  readonly message: string;
}

export interface RequiredRule extends RuleCore<typeof RULE_KIND.REQUIRED> {
  readonly fields: readonly FieldSelector[];
  readonly when?: Condition;
}

export interface RequiredAnyRule extends RuleCore<typeof RULE_KIND.REQUIRED_ANY> {
  readonly fields: readonly FieldSelector[];
  readonly when?: Condition;
}

export interface RowCompleteRule extends RuleCore<typeof RULE_KIND.ROW_COMPLETE> {
  /** The elements a row of the list holds — a row is a member of their axis, or a position in a list. */
  readonly elements: readonly string[];
}

export interface SumRule extends RuleCore<typeof RULE_KIND.SUM> {
  /** In the author's order: a finding sits on the first, where the fix is (§12.5.6's task-40 row). */
  readonly parts: readonly SumPart[];
  readonly total: FieldSelector;
  readonly relation: Relation;
}

export interface RangeRule extends RuleCore<typeof RULE_KIND.RANGE> {
  readonly fields: readonly FieldSelector[];
  /** Inclusive, as a decimal's text. At least one of the two bounds is stated. */
  readonly min?: string;
  readonly max?: string;
}

export interface UrlRule extends RuleCore<typeof RULE_KIND.URL> {
  readonly fields: readonly FieldSelector[];
}

export interface ExclusiveRule extends RuleCore<typeof RULE_KIND.EXCLUSIVE> {
  /** The answer that, once given, leaves the elements below empty. */
  readonly when: Condition;
  readonly empty: readonly string[];
}

export interface YearOverYearRule extends RuleCore<typeof RULE_KIND.YEAR_OVER_YEAR> {
  /** One proportion for every numeric element (182/28) — `0.5` is ±50%, the starting value. Positive. */
  readonly proportion: string;
}

export type Rule =
  | RequiredRule
  | RequiredAnyRule
  | RowCompleteRule
  | SumRule
  | RangeRule
  | UrlRule
  | ExclusiveRule
  | YearOverYearRule;

/** A configuration payload's shape — `{ rules }`, as the applicability artefact's is. */
export interface RuleSet {
  readonly rules: readonly Rule[];
}

/**
 * Every element a rule names, its condition's included — what must be in the evaluation's scope for the rule to run.
 * The year-over-year rule names none: it reads every numeric value in scope.
 */
export function elementsOf(rule: Rule): readonly string[] {
  switch (rule.kind) {
    case RULE_KIND.REQUIRED:
    case RULE_KIND.REQUIRED_ANY:
      return [...rule.fields.map((field) => field.element), ...(rule.when === undefined ? [] : [rule.when.element])];
    case RULE_KIND.ROW_COMPLETE:
      return rule.elements;
    case RULE_KIND.SUM:
      return [...rule.parts.map((part) => part.element), rule.total.element];
    case RULE_KIND.RANGE:
    case RULE_KIND.URL:
      return rule.fields.map((field) => field.element);
    case RULE_KIND.EXCLUSIVE:
      return [rule.when.element, ...rule.empty];
    case RULE_KIND.YEAR_OVER_YEAR:
      return [];
  }
}
