import { COMPARABILITY, VALUE_COLUMN, COLUMN_OF_KIND } from '@easyesg/contracts';
import type { DisclosureField, PriorPeriodComparatives } from '@easyesg/contracts';
import { writeKey } from './autosave-state';

/**
 * Last year's answers, indexed the way this year's fields are addressed (FR-46, UC-45; task 36.14).
 *
 * **Keyed by §7.3's natural key, not by element.** A prior value belongs to one element, one
 * dimension member and one ordinal — B8's Moldova row and its Romania row are different answers to
 * the same element — so an element-keyed index would put one country's headcount beside another's.
 * `writeKey` is the same function the autosave queue addresses a field with, so the two cannot
 * disagree about what *the same field* means.
 *
 * **Only comparable values are indexed, and that is the point of the filter rather than tidiness.**
 * FR-46 exists so *"an implausible year-over-year movement is visible while it can still be
 * checked"*, and a comparison is only a comparison when the two sides measure the same thing. Task
 * 34.3 resolved that across the two version pins: `element_absent` has no field to sit beside at
 * all, and `shape_changed` has one whose kind or period type moved — a duration that became an
 * instant is not last year's figure, and showing it would invite exactly the false comparison this
 * requirement exists to prevent.
 */
export function priorValuesOf(prior: PriorPeriodComparatives | null): ReadonlyMap<string, PriorValue> {
  if (prior === null) return new Map();
  const indexed = new Map<string, PriorValue>();
  for (const value of prior.values) {
    if (value.comparability !== COMPARABILITY.COMPARABLE) continue;
    indexed.set(
      writeKey({
        elementKey: value.elementKey,
        dimensionKey: value.dimensionKey,
        ordinal: value.ordinal,
      }),
      value,
    );
  }
  return indexed;
}

/** One comparable prior answer, as the contract serves it. */
export type PriorValue = PriorPeriodComparatives['values'][number];

/**
 * What last year's answer reads as, in this field's own column.
 *
 * **Empty where the prior row carries no value in the column this kind uses** — a field answered
 * `not_available` last year has a state and a reason and no figure, and *"Prior period:"* followed
 * by nothing is worse than no row at all. The caller shows nothing rather than an empty comparative.
 */
export function priorDraftOf(input: {
  readonly field: Pick<DisclosureField, 'kind'>;
  readonly prior: PriorValue;
}): string {
  switch (COLUMN_OF_KIND[input.field.kind]) {
    case VALUE_COLUMN.NUMERIC:
      return input.prior.valueNumeric ?? '';
    case VALUE_COLUMN.DATE:
      return input.prior.valueDate ?? '';
    case VALUE_COLUMN.BOOLEAN:
      return input.prior.valueBoolean === null ? '' : String(input.prior.valueBoolean);
    default:
      return input.prior.valueText ?? '';
  }
}
