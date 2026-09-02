import {
  COLUMN_OF_KIND,
  DISCLOSURE_STATE,
  VALUE_COLUMN,
  type DisclosureField,
  type DisclosureValueResponse,
  type DisclosureValueWrite,
} from '@easyesg/contracts';

/**
 * From a control's draft to the write the store takes, and back (task 35.2).
 *
 * Which of the four typed columns a kind answers into is the taxonomy's business (§7.3), and the
 * browser reads that decision from `@easyesg/contracts`' `COLUMN_OF_KIND` rather than restating it.
 */
export { COLUMN_OF_KIND, VALUE_COLUMN } from '@easyesg/contracts';

/**
 * Reads a decimal the way a Moldovan reader types one, and answers the canonical string the wire
 * carries (NFR-58: a decimal as a string, never a float).
 *
 * Field-level UX with no business meaning, which is what may live in the form (root `CLAUDE.md`):
 * a space is the thousands separator §11 formats with, a comma is the decimal separator in `ro`
 * and `ru`, and either is accepted alongside the dot. What is refused is anything that is not a
 * number — two separators, letters, an empty sign — because the column is `numeric` and the
 * database would refuse it with a message no reader can act on.
 *
 * Empty is a legitimate answer here: it means *clear the field*, which the caller writes as a
 * `missing` state rather than as a value.
 */
export const parseDecimalInput = (raw: string): { readonly value: string | null } | { readonly invalid: true } => {
  const compact = raw.replace(/\s/gu, '');
  if (compact === '') return { value: null };
  const normalised = compact.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/u.test(normalised) ? { value: normalised } : { invalid: true };
};

/**
 * A boolean disclosure as a choice — the two option values the control offers. Radix reserves `''`
 * for "no choice", which is what an unanswered boolean is, so neither member may be empty.
 */
export const BOOLEAN_CHOICE = { YES: 'yes', NO: 'no' } as const;

export type BooleanChoice = (typeof BOOLEAN_CHOICE)[keyof typeof BOOLEAN_CHOICE];

/** The value a field currently holds in the column its kind answers into, as the draft a control shows. */
export function draftOf(field: DisclosureField): string {
  switch (COLUMN_OF_KIND[field.kind]) {
    case VALUE_COLUMN.NUMERIC:
      return field.valueNumeric ?? '';
    case VALUE_COLUMN.DATE:
      return field.valueDate ?? '';
    case VALUE_COLUMN.BOOLEAN:
      if (field.valueBoolean === null) return '';
      return field.valueBoolean ? BOOLEAN_CHOICE.YES : BOOLEAN_CHOICE.NO;
    default:
      return field.valueText ?? '';
  }
}

/**
 * The write for one field's new value, or its clearing.
 *
 * `null` clears: the row keeps its natural key and moves to `missing` with every column null, which
 * the store's own constraint admits. The carried-forward mark is dropped on any edit (UX-32: marked
 * as carried *until edited*), and a not-available reason cannot outlive its state (§7.3's check).
 */
export function writeFor(
  field: Pick<DisclosureField, 'elementKey' | 'dimensionKey' | 'ordinal' | 'kind' | 'unitCode'>,
  value: string | boolean | null,
): DisclosureValueWrite {
  const column = COLUMN_OF_KIND[field.kind];
  // The generated write type carries no `null`: an absent column is omitted, and the api's own
  // controller reads an omission as null. Only the answered column is set.
  const base: DisclosureValueWrite = {
    elementKey: field.elementKey,
    dimensionKey: field.dimensionKey,
    ordinal: field.ordinal,
    ...(field.unitCode === null ? {} : { unitCode: field.unitCode }),
    state: value === null ? DISCLOSURE_STATE.MISSING : DISCLOSURE_STATE.OK,
    carriedForward: false,
  };
  if (value === null) return base;
  switch (column) {
    case VALUE_COLUMN.NUMERIC:
      return { ...base, valueNumeric: String(value) };
    case VALUE_COLUMN.DATE:
      return { ...base, valueDate: String(value) };
    case VALUE_COLUMN.BOOLEAN:
      return { ...base, valueBoolean: typeof value === 'boolean' ? value : value === BOOLEAN_CHOICE.YES };
    default:
      return { ...base, valueText: String(value) };
  }
}

/** A field as the screen shows it once the API has acknowledged a write for it. */
export function withCommitted(
  field: DisclosureField,
  value: DisclosureValueResponse | undefined,
): DisclosureField {
  return value === undefined
    ? field
    : {
        ...field,
        valueNumeric: value.valueNumeric,
        valueText: value.valueText,
        valueBoolean: value.valueBoolean,
        valueDate: value.valueDate,
        unitCode: value.unitCode,
        state: value.state,
        notAvailableReason: value.notAvailableReason,
        carriedForward: value.carriedForward,
      };
}
