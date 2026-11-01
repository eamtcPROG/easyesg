import type { CalcLineOverride, CalcSourceContents, MonthlyQuantities } from '../models/calc-source.model';
import type { FactorSet } from '../models/factor-set.model';
import { isDecimalString } from '@api/contracts/types/decimal';
import { MONTHS_IN_FORM } from './period-months';

/**
 * Whether an invoice line can be calculated, and if not, why (task 38.1; FR-33, UX-14, UX-40).
 *
 * **Two checks, because they are asked at different moments.** The contents are the line's own shape and hold under
 * any factor set. Whether its source and unit are ones the factors cover depends on *which* set: a line is checked
 * against the set its period resolves when it is written, and again against the set a run pins when the run is
 * recorded — the same set, unless a correction was published in between and dropped the source or the unit.
 *
 * Pure, so each refusal is a unit case rather than a request; the use cases turn a refusal into its error.
 */
export const CALC_SOURCE_REFUSAL = {
  /** Not a figure with its unit, nor a reason with neither — or both at once. */
  CONTENTS: 'contents',
  /** A source the factor set does not cover. */
  SOURCE: 'source',
  /** A unit the source cannot be entered in. */
  UNIT: 'unit',
  /** A replacement figure that is not a decimal, carries no reason, or replaces nothing computed (task 38.4). */
  OVERRIDE: 'override',
  /**
   * Month figures that are not the monthly form (task 39.1): not twelve, one that is not a number, none entered at
   * all, sent beside a quantity or a reason, or on a period that does not span twelve calendar months.
   */
  MONTHS: 'months',
} as const;
export type CalcSourceRefusal = (typeof CALC_SOURCE_REFUSAL)[keyof typeof CALC_SOURCE_REFUSAL];

/** A figure with its unit, or a reason and neither — the table's own CHECK, refused before it is reached. */
export function contentsRefusal(contents: CalcSourceContents): CalcSourceRefusal | null {
  const { quantity, unitCode, notAvailableReason } = contents;
  if (notAvailableReason !== null) {
    return notAvailableReason.trim() !== '' && quantity === null && unitCode === null
      ? null
      : CALC_SOURCE_REFUSAL.CONTENTS;
  }
  return isDecimalString(quantity) && unitCode !== null && unitCode !== '' ? null : CALC_SOURCE_REFUSAL.CONTENTS;
}

/**
 * Whether the factor set covers the line: its source, and — where it has a figure — the unit the figure is in.
 *
 * An explained line names a source and no unit, and is covered by the source alone: *"billed by the landlord"* is
 * still electricity from the grid, and B3's figure says one of its sites could not be measured.
 */
export function factorRefusal(input: {
  readonly sourceKey: string;
  readonly contents: CalcSourceContents;
  readonly factorSet: FactorSet;
}): CalcSourceRefusal | null {
  const source = input.factorSet.sources.get(input.sourceKey);
  if (source === undefined) return CALC_SOURCE_REFUSAL.SOURCE;
  const { unitCode } = input.contents;
  if (unitCode !== null && !source.units.has(unitCode)) return CALC_SOURCE_REFUSAL.UNIT;
  return null;
}

/**
 * A line's replacement figure (task 38.4; UC-34, UX-43): tonnes written as a decimal, a reason with words in it, and a
 * measured line under it — an explained line has no computed figure, so there is nothing for it to replace. The
 * table's `CHECK` holds the same three; this refuses before the constraint is met.
 */
export function overrideRefusal(input: {
  readonly contents: CalcSourceContents;
  readonly override: CalcLineOverride | null;
}): CalcSourceRefusal | null {
  if (input.override === null) return null;
  const { tonnesCo2e, explanation } = input.override;
  if (!isDecimalString(tonnesCo2e) || explanation.trim() === '' || input.contents.quantity === null) {
    return CALC_SOURCE_REFUSAL.OVERRIDE;
  }
  return null;
}

/**
 * A line's month figures, where it has them (task 39.1; §12.5.6's task-39 row (1)): twelve, each a decimal or empty,
 * at least one entered, in the line's one unit — and **no quantity beside them**, because the quantity is their sum
 * and the server computes it, nor a reason, because a line with months has a figure. Whether the period offers the
 * form is asked separately, against the report, by the use case.
 */
export function monthsRefusal(input: {
  readonly contents: CalcSourceContents;
  readonly monthlyQuantities: MonthlyQuantities | null;
}): CalcSourceRefusal | null {
  const months = input.monthlyQuantities;
  if (months === null) return null;
  const { quantity, unitCode, notAvailableReason } = input.contents;
  const shaped =
    months.length === MONTHS_IN_FORM &&
    months.every((month) => month === null || isDecimalString(month)) &&
    months.some((month) => month !== null);
  return shaped && quantity === null && notAvailableReason === null && unitCode !== null && unitCode !== ''
    ? null
    : CALC_SOURCE_REFUSAL.MONTHS;
}
