/**
 * A non-negative decimal written as a string, the one shape every number in the calculator travels in (§7.9, NFR-58):
 * a factor in a published set (task 37.1) and a quantity on an invoice line (task 38.1).
 *
 * **One definition for both readers**, because they must agree: a quantity the line accepts that the arithmetic later
 * reads differently is a figure that changes between entry and calculation. No sign, no exponent, no thousands
 * separator — the screen accepts `1 700` and `1.700` as typed (S-09's artboard) and sends the canonical form.
 */
const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;

export const isDecimalString = (value: unknown): value is string => typeof value === 'string' && DECIMAL.test(value);

/** Greater than zero as well — a conversion to no energy at all is a mistyped factor, never a real one. */
export const isPositiveDecimalString = (value: unknown): value is string =>
  isDecimalString(value) && /[1-9]/.test(value);
