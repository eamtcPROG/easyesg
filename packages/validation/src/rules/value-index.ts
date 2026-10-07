import type { FieldSelector } from './rule-definition.js';
import { addressOf, compareAddresses, type FieldAddress, type FieldValue } from './field-value.js';

/**
 * A report's answers by element, each element's rows in natural-key order (task 40.2) — built once per evaluation, so
 * a rule finds its fields by lookup rather than by scanning every value (NFR-39's 2 s budget is for a full report).
 *
 * **Sorted on the way in** so that nothing downstream depends on the order a caller listed its values in: the api reads
 * rows in the store's order and the browser in its step's, and the findings must come out identical (task 40.3).
 */
export type ValueIndex = ReadonlyMap<string, readonly FieldValue[]>;

export function indexValues(values: readonly FieldValue[]): ValueIndex {
  const byElement = new Map<string, FieldValue[]>();
  for (const value of values) {
    const rows = byElement.get(value.elementKey);
    if (rows === undefined) byElement.set(value.elementKey, [value]);
    else rows.push(value);
  }
  for (const rows of byElement.values()) rows.sort((left, right) => compareAddresses(addressOf(left), addressOf(right)));
  return byElement;
}

/** The rows a selector names: one member's, or with no member every row the element holds. */
export function rowsAt(index: ValueIndex, selector: FieldSelector): readonly FieldValue[] {
  const rows = index.get(selector.element) ?? [];
  if (selector.member === undefined) return rows;
  return rows.filter((row) => (row.dimensionKey ?? '') === selector.member);
}

/**
 * Where a finding about a selector sits when no row says — an unanswered field has none. The member's own address,
 * or with no member the element as a whole: no member, position `0`, which a deep link reads as the list itself.
 */
export const addressAt = (selector: FieldSelector): FieldAddress => ({
  elementKey: selector.element,
  dimensionKey: selector.member ?? '',
  ordinal: 0,
});
