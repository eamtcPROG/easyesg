import type { WriteCalcLineRequest } from '@easyesg/contracts';
import type { LineView } from './lines';
import { monthTotal } from './month-total';

/**
 * What a line says, and the one write that says it (task 39.1; FR-33) — a line is written whole under its id, so every
 * edit on S-09, whichever control made it, becomes the line's full request here and nowhere else.
 *
 * **A line the api would refuse for being empty is not sent**: a figure with its unit, months with one entered, or a
 * reason — one of the three, or `null`. That is field-level required-ness, the kind the root `CLAUDE.md` lets a form
 * keep; whether the source, unit and site are ones the factors admit is the api's to say, and it says it.
 */
export type LineFields = Omit<LineView, 'id' | 'pending' | 'overriddenBy'>;

// Who overrode the line is the server's to say (task 39.4), so it is no field a write could carry.
export const fieldsOf = ({ id: _id, pending: _pending, overriddenBy: _by, ...fields }: LineView): LineFields => fields;

/** The month at `index` set to `value` — `null` empties it — in a twelve-row form that may not exist yet. */
export function withMonth(input: {
  readonly months: readonly (string | null)[] | null;
  readonly index: number;
  readonly value: string | null;
  readonly length: number;
}): (string | null)[] {
  const months = input.months === null ? Array.from({ length: input.length }, () => null) : [...input.months];
  months[input.index] = input.value;
  return months;
}

export function writeOf(fields: LineFields): WriteCalcLineRequest | null {
  const base = { siteOrdinal: fields.siteOrdinal, sourceKey: fields.sourceKey, description: fields.description };
  if (fields.notAvailableReason !== null) {
    if (fields.notAvailableReason.trim() === '') return null;
    // An explained line has no figure, so nothing computed for an override to replace (the api's own rule).
    return { ...base, notAvailableReason: fields.notAvailableReason };
  }
  if (fields.unitCode === null) return null;
  const override =
    fields.overrideTonnes === null ? {} : { overrideTonnes: fields.overrideTonnes, overrideExplanation: fields.overrideExplanation };
  if (fields.monthlyQuantities !== null) {
    // The server sums the months into the quantity; sending one beside them is refused.
    return monthTotal(fields.monthlyQuantities) === null
      ? null
      : { ...base, unitCode: fields.unitCode, monthlyQuantities: [...fields.monthlyQuantities], ...override };
  }
  return fields.quantity === null ? null : { ...base, quantity: fields.quantity, unitCode: fields.unitCode, ...override };
}
