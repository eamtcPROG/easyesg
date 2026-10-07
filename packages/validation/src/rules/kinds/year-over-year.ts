import type { YearOverYearRule } from '../rule-definition.js';
import {
  absoluteDecimal,
  compareDecimals,
  formatDecimal,
  multiplyDecimals,
  readDecimal,
  subtractDecimals,
} from '../decimal.js';
import { addressOf, numberOf, unitOf, type FieldValue } from '../field-value.js';
import type { Finding } from '../finding.js';
import type { EvaluationContext } from './evaluation-context.js';

/**
 * `year_over_year` (task 40.2; FR-46 item 5, UX-33, 182/28): **a movement beyond one global proportion** against the
 * prior period's value raises `VALUE INCONSISTENCY`, not `ERROR`, because the movement may be real. The message states
 * both values and the change, so the finding quotes all three.
 *
 * - **Every numeric value in scope**, of every element alike — no list of elements, which is what *one global
 *   proportion* means; a calculated figure moves like a typed one.
 * - **Against the prior value at the same natural key** (FR-46 item 3): B8's Moldova row beside last year's Moldova
 *   row. The caller passes comparable values only (FR-45), so a value whose shape changed is never read here.
 * - **Beyond means strictly greater**: `|current − prior| > proportion × |prior|`, multiplied rather than divided, so it
 *   stays exact. A movement of exactly the proportion is not flagged.
 * - **A prior of zero is skipped** — a proportion of zero is undefined (182/28) — and so is either value declared not
 *   available, and a pair in different units, which nothing converts (§12.5.6's task-40 row (3)).
 */
const priorKey = (value: FieldValue): string => {
  const address = addressOf(value);
  return `${address.elementKey}\u0000${address.dimensionKey}\u0000${address.ordinal}`;
};

export function evaluateYearOverYear(rule: YearOverYearRule, context: EvaluationContext): readonly Finding[] {
  const proportion = readDecimal(rule.proportion);
  if (proportion === null) return [];
  const priorAt = new Map(
    [...context.prior.values()].flatMap((rows) => rows.map((row) => [priorKey(row), row] as const)),
  );
  return [...context.current.entries()]
    .filter(([element]) => context.scope.has(element))
    .flatMap(([, rows]) =>
      rows.flatMap((row) => {
        const prior = priorAt.get(priorKey(row));
        if (prior === undefined || unitOf(prior) !== unitOf(row)) return [];
        const current = numberOf(row);
        const previous = numberOf(prior);
        if (current === null || previous === null || previous.units === 0n) return [];
        const change = subtractDecimals(current, previous);
        const allowed = multiplyDecimals(proportion, absoluteDecimal(previous));
        if (compareDecimals(absoluteDecimal(change), allowed) <= 0) return [];
        return [
          {
            rule: rule.id,
            verdict: rule.verdict,
            field: addressOf(row),
            related: [],
            message: rule.message,
            params: {
              current: formatDecimal(current),
              prior: formatDecimal(previous),
              change: formatDecimal(change),
            },
          },
        ];
      }),
    );
}
