import { RELATION, type Relation, type SumRule } from '../rule-definition.js';
import {
  ZERO,
  addDecimals,
  compareDecimals,
  formatDecimal,
  multiplyDecimals,
  readDecimal,
  type Scaled,
} from '../decimal.js';
import { isDeclaredUnavailable, numberOf, unitOf, type FieldValue } from '../field-value.js';
import type { Finding } from '../finding.js';
import { addressAt, rowsAt } from '../value-index.js';
import type { EvaluationContext } from './evaluation-context.js';

/**
 * `sum` (task 40.2): **weighted parts against a total** — the calculation linkbase's relation (§9.8: *"waste fractions
 * must total waste; GHG rollups must reconcile"*) and the template's one-sided checks beside it.
 *
 * **The gaps, as the owner settled them** (§12.5.6's task-40 row (3)):
 * - a part with no number **counts as zero once any part has one**, as the template's `SUM` does;
 * - the rule **waits** while no part, or no total, has a number — a presence rule says what is missing;
 * - a part or the total **declared not available suspends it**: a reasoned gap is an answer (D-4), and a sum over it
 *   would flag the reporter for having said so;
 * - operands in **different units give no verdict**, and nothing is converted — `kg` beside `t` is not a disagreement
 *   this rule can see;
 * - the comparison is **exact**, with no tolerance, since the template's is.
 *
 * One finding per rule, **on the first part, where the fix is** — a gender split that does not reach headcount is put
 * right in the split — linking the other parts and the total (FR-42 item 4).
 */
const ONE: Scaled = { units: 1n, places: 0 };

const relationHolds = (relation: Relation, order: number): boolean => {
  switch (relation) {
    case RELATION.EQUAL:
      return order === 0;
    case RELATION.AT_MOST:
      return order <= 0;
    case RELATION.AT_LEAST:
      return order >= 0;
  }
};

const numbersIn = (rows: readonly FieldValue[]) =>
  rows.flatMap((row) => {
    const number = numberOf(row);
    return number === null ? [] : [{ number, unit: unitOf(row) }];
  });

export function evaluateSum(rule: SumRule, context: EvaluationContext): readonly Finding[] {
  const partRows = rule.parts.map((part) => rowsAt(context.current, part));
  const totalRows = rowsAt(context.current, rule.total);
  if ([...partRows.flat(), ...totalRows].some(isDeclaredUnavailable)) return [];

  const partNumbers = partRows.map(numbersIn);
  const totalNumbers = numbersIn(totalRows);
  if (totalNumbers.length === 0 || partNumbers.every((numbers) => numbers.length === 0)) return [];
  if (new Set([...partNumbers.flat(), ...totalNumbers].map(({ unit }) => unit)).size > 1) return [];

  const parts = rule.parts.reduce((sum, part, index) => {
    const weight = readDecimal(part.weight ?? '1') ?? ONE;
    return partNumbers[index].reduce((acc, { number }) => addDecimals(acc, multiplyDecimals(number, weight)), sum);
  }, ZERO);
  const total = totalNumbers.reduce((acc, { number }) => addDecimals(acc, number), ZERO);
  if (relationHolds(rule.relation, compareDecimals(parts, total))) return [];

  const [first, ...others] = rule.parts;
  return [
    {
      rule: rule.id,
      verdict: rule.verdict,
      field: addressAt(first),
      related: [...others.map(addressAt), addressAt(rule.total)],
      message: rule.message,
      params: { parts: formatDecimal(parts), total: formatDecimal(total) },
    },
  ];
}
