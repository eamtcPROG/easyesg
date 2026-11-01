import type { DisclosureValue, DisclosureValueKey } from '../models/disclosure-value.model';

/**
 * A report's stored values, indexed both ways the wizard's reads need them (task 89): by §7.3's natural key, so a
 * field finds its value without a nested scan, and by element, so an element's rows — a repeating group's sites, a
 * breakdown's members — come together.
 *
 * **Pure, and apart from the read that fetches them**: the store answers a flat list in whatever order its plan chose,
 * and what the use case wants from it is this shape, which needs no store to test.
 */

/** The store's natural key as one string, so a field finds its value without a nested scan. */
export const keyOf = (v: Pick<DisclosureValueKey, 'elementKey' | 'dimensionKey' | 'ordinal'>): string =>
  `${v.elementKey}\u0000${v.dimensionKey}\u0000${v.ordinal}`;

/** The stored values, indexed both ways the reads need them. */
export interface StoredValues {
  readonly byKey: ReadonlyMap<string, DisclosureValue>;
  readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
}

/** Each element's rows keep the order the store gave them; nothing here sorts. */
export function indexStored(stored: readonly DisclosureValue[]): StoredValues {
  const byElement = new Map<string, DisclosureValue[]>();
  for (const value of stored) {
    byElement.set(value.elementKey, [...(byElement.get(value.elementKey) ?? []), value]);
  }
  return { byKey: new Map(stored.map((value) => [keyOf(value), value])), byElement };
}
