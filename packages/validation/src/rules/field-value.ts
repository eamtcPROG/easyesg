import { readDecimal, type Scaled } from './decimal.js';

/**
 * One stored answer as the interpreter reads it (task 40.2) — **the store's own row shape** (§7.3), so `apps/api`
 * passes its `DisclosureValue`s and `apps/web` its step's fields with no mapping, and the two cannot come to read a
 * row differently.
 *
 * **Every member but the element is optional, and an absent one means the column's own default**: no axis member
 * (`''`, the store's `NO_DIMENSION`), position `0`, no value in a column, and the answer state `ok` — the default
 * since 182/17 left the row's state holding answers only. Both callers send every member; the defaults let the shared
 * corpus state a case in the fields it is about.
 */
export interface FieldValue {
  readonly elementKey: string;
  readonly dimensionKey?: string;
  readonly ordinal?: number;
  readonly valueNumeric?: string | null;
  readonly valueText?: string | null;
  readonly valueBoolean?: boolean | null;
  readonly valueDate?: string | null;
  readonly unitCode?: string | null;
  /** The answer axis: `ok`, `nil_return` or `not_available`. Never a verdict — those live in the findings (182/17). */
  readonly state?: string;
}

/** Where a finding sits — the store's natural key within a report, which is what a deep link lands on (FR-42). */
export interface FieldAddress {
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
}

/**
 * **The one answer state the interpreter reads by name**: declared not available, with a reason (FR-32, D-4) — an
 * answer with no value, never `MISSING VALUE`. The row's other answer states need no name here (182/17): `ok` is
 * read from its content, and a nil return (FR-30) from the zero it always holds — the api derives the state from the
 * stored `0` (`answeredState`), so a nil return with an empty column is not a row the store can hold.
 */
const NOT_AVAILABLE = 'not_available';

export const addressOf = (value: FieldValue): FieldAddress => ({
  elementKey: value.elementKey,
  dimensionKey: value.dimensionKey ?? '',
  ordinal: value.ordinal ?? 0,
});

export const isDeclaredUnavailable = (value: FieldValue): boolean => value.state === NOT_AVAILABLE;

const filled = (text: string | null | undefined): boolean => text !== null && text !== undefined && text.trim() !== '';

/**
 * Does the row hold a value — content in a column, an answered zero included? A declaration of not available does
 * not: it is an answer, but it gives nothing a condition or a sum could read.
 */
export function holdsValue(value: FieldValue): boolean {
  if (isDeclaredUnavailable(value)) return false;
  return (
    filled(value.valueNumeric) ||
    filled(value.valueText) ||
    filled(value.valueDate) ||
    (value.valueBoolean !== null && value.valueBoolean !== undefined)
  );
}

/**
 * Is the field answered, as a presence rule asks? A value, or a declaration of not available — FR-40 AC-3: a reasoned
 * gap is that state and never `MISSING VALUE`. A row whose columns are all empty is no answer: it is what a cleared
 * field leaves behind.
 */
export const isAnswered = (value: FieldValue): boolean => holdsValue(value) || isDeclaredUnavailable(value);

/**
 * The number a row holds, or `null` where it holds none a rule can compute with: declared not available, empty, or a
 * text that is not a decimal. An answered zero is zero.
 */
export function numberOf(value: FieldValue): Scaled | null {
  if (isDeclaredUnavailable(value) || value.valueNumeric === null || value.valueNumeric === undefined) return null;
  return readDecimal(value.valueNumeric);
}

/** The unit a number is in, `null` where it carries none — two operands are comparable only in the same one. */
export const unitOf = (value: FieldValue): string | null => value.unitCode ?? null;

/**
 * Code-unit order over the natural key, **never `localeCompare`**, whose answer depends on the runtime's locale data:
 * the same findings must come out in the same order in the api and in the browser (task 40.3).
 */
export function compareAddresses(left: FieldAddress, right: FieldAddress): number {
  if (left.elementKey !== right.elementKey) return left.elementKey < right.elementKey ? -1 : 1;
  if (left.dimensionKey !== right.dimensionKey) return left.dimensionKey < right.dimensionKey ? -1 : 1;
  return left.ordinal - right.ordinal;
}
