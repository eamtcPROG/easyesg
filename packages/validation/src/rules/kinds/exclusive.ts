import type { ExclusiveRule } from '../rule-definition.js';
import { addressOf, isAnswered } from '../field-value.js';
import type { Finding } from '../finding.js';
import { addressAt } from '../value-index.js';
import { conditionHolds } from './condition.js';
import type { EvaluationContext } from './evaluation-context.js';

/**
 * `exclusive` (task 40.2): **an answer that leaves other elements empty** — the template's B4 check, where a reporter
 * who says the pollution figures are published elsewhere and also fills the table in has said two things that cannot
 * both stand. One finding, on the answer that excludes, linking every row it conflicts with (FR-42 item 4), so the
 * reporter chooses which to keep.
 */
export function evaluateExclusive(rule: ExclusiveRule, context: EvaluationContext): readonly Finding[] {
  if (!conditionHolds(rule.when, context.current)) return [];
  const conflicting = rule.empty.flatMap((element) =>
    (context.current.get(element) ?? []).filter(isAnswered).map(addressOf),
  );
  if (conflicting.length === 0) return [];
  return [
    {
      rule: rule.id,
      verdict: rule.verdict,
      field: addressAt({ element: rule.when.element }),
      related: conflicting,
      message: rule.message,
      params: {},
    },
  ];
}
