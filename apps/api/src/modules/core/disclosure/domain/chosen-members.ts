import type { TaxonomyElement } from '@api/contracts/taxonomy-registry.port';
import { NO_DIMENSION, type DisclosureValue } from '../models/disclosure-value.model';

/**
 * Which members a report has chosen on each classification axis (task 36.5).
 *
 * **Axis-wide rather than per element**, because a classification's rows are a *table's* rows: the
 * reporter names a pollutant once and answers air, water and soil for it. An element with no stored
 * value under a chosen member still gets its cell, which is the difference between an empty cell and
 * a pollutant nobody named — and a distinction no client could make from per-element rows.
 *
 * Sorted, so the same report renders in the same order twice: the store's rows come back in
 * whatever order the query's plan chose, which is not an order at all.
 *
 * **Pure: which axis an element is selected along, and what that axis admits, are asked of the caller** — both are
 * `MemberResolver`'s answers, read through the registry.
 */
export function chosenMembers(input: {
  readonly elements: readonly TaxonomyElement[];
  readonly classificationOf: (element: TaxonomyElement) => string | null;
  readonly admits: (query: { readonly axis: string; readonly member: string }) => boolean;
  readonly byElement: ReadonlyMap<string, readonly DisclosureValue[]>;
}): ReadonlyMap<string, readonly string[]> {
  const gathering = new Map<string, Set<string>>();
  for (const element of input.elements) {
    const axis = input.classificationOf(element);
    if (axis === null) continue;
    const members = gathering.get(axis) ?? new Set<string>();
    gathering.set(axis, members);
    for (const value of input.byElement.get(element.key) ?? []) {
      // **Checked against the axis's own domain** (spec review, 8 Sep 2026). Before this task a
      // stored key the axis does not declare was simply never read; a classification derives its
      // rows FROM the store, so without this an arbitrary string materialises as a visible row on
      // every element of the axis, labelled *unnamed*. The step read is not the place to repair
      // such a row — it is the place not to draw one.
      if (value.dimensionKey !== NO_DIMENSION && input.admits({ axis, member: value.dimensionKey })) {
        members.add(value.dimensionKey);
      }
    }
  }
  return new Map([...gathering].map(([axis, members]) => [axis, [...members].sort()]));
}
