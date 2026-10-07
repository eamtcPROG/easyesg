import type { FieldSelector, RequiredAnyRule, RequiredRule } from '../rule-definition.js';
import { isAnswered } from '../field-value.js';
import type { Finding } from '../finding.js';
import { addressAt, rowsAt } from '../value-index.js';
import { conditionHolds } from './condition.js';
import type { EvaluationContext } from './evaluation-context.js';

/**
 * The two presence kinds (task 40.2; FR-40's `MISSING VALUE`): `required` — each field it names is answered — and
 * `required_any` — at least one is. **Answered includes a declaration of not available** (FR-40 AC-3, D-4), and a
 * nil return is an answer (FR-30). Neither runs while its `when` does not hold: B4's link is required only once the
 * disclosure is said to be public.
 *
 * Together because they are one question asked of a list in two ways — *all* or *any* — over the same answer and the
 * same condition.
 */
const answeredIn = (context: EvaluationContext, field: FieldSelector): boolean =>
  rowsAt(context.current, field).some(isAnswered);

const applies = (context: EvaluationContext, rule: RequiredRule | RequiredAnyRule): boolean =>
  rule.when === undefined || conditionHolds(rule.when, context.current);

/** A finding per unanswered field, where the field is — its member's address, or the element's for a whole list. */
export function evaluateRequired(rule: RequiredRule, context: EvaluationContext): readonly Finding[] {
  if (!applies(context, rule)) return [];
  return rule.fields
    .filter((field) => !answeredIn(context, field))
    .map((field) => ({
      rule: rule.id,
      verdict: rule.verdict,
      field: addressAt(field),
      related: [],
      message: rule.message,
      params: {},
    }));
}

/** One finding when none is answered, on the first field and linking the others the reporter may answer instead. */
export function evaluateRequiredAny(rule: RequiredAnyRule, context: EvaluationContext): readonly Finding[] {
  if (!applies(context, rule) || rule.fields.some((field) => answeredIn(context, field))) return [];
  const [first, ...others] = rule.fields;
  return [
    {
      rule: rule.id,
      verdict: rule.verdict,
      field: addressAt(first),
      related: others.map(addressAt),
      message: rule.message,
      params: {},
    },
  ];
}
