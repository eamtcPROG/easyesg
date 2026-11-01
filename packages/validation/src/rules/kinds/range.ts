import type { RangeRule } from '../rule-definition.js';
import { compareDecimals, formatDecimal, readDecimal } from '../decimal.js';
import { addressOf, numberOf } from '../field-value.js';
import type { Finding } from '../finding.js';
import { rowsAt } from '../value-index.js';
import type { EvaluationContext } from './evaluation-context.js';

/**
 * `range` (task 40.2): a number within an **inclusive** minimum and maximum — §9.8's *non-negativity* is a minimum of
 * zero, and a percentage's ceiling a maximum of 100. A finding per row outside them, quoting the value and the bounds
 * the rule states. A row with no number is no finding: a value that is not a number cannot be stored (the column is
 * `numeric`), and an unanswered one is a presence rule's.
 */
export function evaluateRange(rule: RangeRule, context: EvaluationContext): readonly Finding[] {
  const min = rule.min === undefined ? null : readDecimal(rule.min);
  const max = rule.max === undefined ? null : readDecimal(rule.max);
  const bounds = {
    ...(rule.min === undefined ? {} : { min: rule.min }),
    ...(rule.max === undefined ? {} : { max: rule.max }),
  };
  return rule.fields.flatMap((field) =>
    rowsAt(context.current, field).flatMap((row) => {
      const number = numberOf(row);
      if (number === null) return [];
      const below = min !== null && compareDecimals(number, min) < 0;
      const above = max !== null && compareDecimals(number, max) > 0;
      if (!below && !above) return [];
      return [
        {
          rule: rule.id,
          verdict: rule.verdict,
          field: addressOf(row),
          related: [],
          message: rule.message,
          params: { value: formatDecimal(number), ...bounds },
        },
      ];
    }),
  );
}
