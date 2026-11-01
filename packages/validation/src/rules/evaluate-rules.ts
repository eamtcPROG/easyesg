import { RULE_KIND, elementsOf, type Rule, type RuleSet } from './rule-definition.js';
import { compareAddresses, type FieldValue } from './field-value.js';
import type { Finding } from './finding.js';
import { indexValues } from './value-index.js';
import type { EvaluationContext } from './kinds/evaluation-context.js';
import { evaluateExclusive } from './kinds/exclusive.js';
import { evaluateRange } from './kinds/range.js';
import { evaluateRequired, evaluateRequiredAny } from './kinds/required.js';
import { evaluateRowComplete } from './kinds/row-complete.js';
import { evaluateSum } from './kinds/sum.js';
import { evaluateUrl } from './kinds/url.js';
import { evaluateYearOverYear } from './kinds/year-over-year.js';

/**
 * **The interpreter** (task 40.2; FR-40, FR-43, FR-73, `architecture.md` §9.8): a rule set and a report's answers in,
 * findings out. Pure — no database, no HTTP, no clock, no locale — which is the whole of what lets `apps/api` hold it
 * authoritatively and `apps/web` hold it inline with no drift between the two (task 40.3 proves it).
 *
 * **Deterministic**, so a re-run over unchanged answers is identical (BR-VAL-3): findings come out in rule order, and
 * within a rule in natural-key order, whatever order the caller listed its values in.
 */
export interface RuleEvaluation {
  readonly ruleSet: RuleSet;
  /**
   * The elements a rule may read: those the report's pinned taxonomy version holds, that apply (FR-28's thresholds,
   * which the api evaluates) and whose module is not declared omitted (FR-31). **A rule naming any element outside it
   * is not evaluated** (§12.5.6's task-40 row (1)) — a field that does not apply is neither validated nor counted
   * (FR-40 AC-5), and a browser holding one step passes that step's elements.
   */
  readonly scope: ReadonlySet<string>;
  /** The report's stored answers — every row, in any order. */
  readonly values: readonly FieldValue[];
  /** The prior period's comparable answers (FR-45), for the year-over-year rule. Absent where there is no prior. */
  readonly prior?: readonly FieldValue[];
}

function evaluateRule(rule: Rule, context: EvaluationContext): readonly Finding[] {
  switch (rule.kind) {
    case RULE_KIND.REQUIRED:
      return evaluateRequired(rule, context);
    case RULE_KIND.REQUIRED_ANY:
      return evaluateRequiredAny(rule, context);
    case RULE_KIND.ROW_COMPLETE:
      return evaluateRowComplete(rule, context);
    case RULE_KIND.SUM:
      return evaluateSum(rule, context);
    case RULE_KIND.RANGE:
      return evaluateRange(rule, context);
    case RULE_KIND.URL:
      return evaluateUrl(rule, context);
    case RULE_KIND.EXCLUSIVE:
      return evaluateExclusive(rule, context);
    case RULE_KIND.YEAR_OVER_YEAR:
      return evaluateYearOverYear(rule, context);
  }
}

export function evaluateRules(input: RuleEvaluation): readonly Finding[] {
  const context: EvaluationContext = {
    current: indexValues(input.values),
    prior: indexValues(input.prior ?? []),
    scope: input.scope,
  };
  return input.ruleSet.rules.flatMap((rule) =>
    elementsOf(rule).every((element) => context.scope.has(element))
      ? evaluateRule(rule, context).toSorted((left, right) => compareAddresses(left.field, right.field))
      : [],
  );
}
