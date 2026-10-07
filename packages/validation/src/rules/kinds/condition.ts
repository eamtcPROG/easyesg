import { CONDITION_KIND, type Condition } from '../rule-definition.js';
import { holdsValue } from '../field-value.js';
import type { ValueIndex } from '../value-index.js';

/**
 * Does a rule's condition hold (task 40.2)? Read by the presence kinds' optional `when` and by `exclusive`, so
 * the three cannot come to disagree on what *answered* means.
 *
 * Over every row the element holds: a condition names an element, and a list holds when any of its rows does.
 */
export function conditionHolds(condition: Condition, index: ValueIndex): boolean {
  const rows = index.get(condition.element) ?? [];
  switch (condition.kind) {
    case CONDITION_KIND.ANSWERED:
      return rows.some(holdsValue);
    case CONDITION_KIND.IS_TRUE:
      return rows.some((row) => row.valueBoolean === true);
  }
}
