import type { RowCompleteRule } from '../rule-definition.js';
import { addressOf, isAnswered, type FieldAddress } from '../field-value.js';
import type { Finding } from '../finding.js';
import type { EvaluationContext } from './evaluation-context.js';

/**
 * `row_complete` (task 40.2): **a row of a list, once started, is finished** — the check the template makes on B7's
 * materials and waste and B8's countries, where a row with a name and no figure is `MISSING VALUE` beside it.
 *
 * A row is a member of the elements' axis or a position in their list — the part of the natural key that is not the
 * element — and it is started when any element the rule names is answered there, a declaration of not available
 * included. A list with no row started is no finding: whether a list must hold anything is a presence rule's question.
 */
const rowKey = (address: FieldAddress): string => `${address.dimensionKey}\u0000${address.ordinal}`;

export function evaluateRowComplete(rule: RowCompleteRule, context: EvaluationContext): readonly Finding[] {
  const started = new Map<string, FieldAddress>();
  const answeredAt = new Set<string>();
  for (const element of rule.elements) {
    for (const row of context.current.get(element) ?? []) {
      if (!isAnswered(row)) continue;
      const address = addressOf(row);
      started.set(rowKey(address), address);
      answeredAt.add(`${element}\u0000${rowKey(address)}`);
    }
  }
  return [...started.entries()].flatMap(([key, row]) =>
    rule.elements
      .filter((element) => !answeredAt.has(`${element}\u0000${key}`))
      .map((element) => ({
        rule: rule.id,
        verdict: rule.verdict,
        field: { elementKey: element, dimensionKey: row.dimensionKey, ordinal: row.ordinal },
        related: [],
        message: rule.message,
        params: {},
      })),
  );
}
