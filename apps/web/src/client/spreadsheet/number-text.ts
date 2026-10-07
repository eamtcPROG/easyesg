/**
 * An `.xlsx` number cell's stored text — `1700.5`, `1.5E-3`, `-3`, `1E+21` — as the decimal it spells, with no float
 * in between (task 204.2; NFR-58: a figure travels as a decimal string).
 *
 * **Why the stored text and not the number the reader would hand over.** A workbook stores a number as the text of
 * the double it holds, and `read-excel-file` parses that into a JavaScript number unless asked not to
 * (`parseNumber`). Through a float, a figure a reporter typed as `0.84` can come back as `0.8399999999999999` once
 * anything multiplies it; through its text it is moved by its digits alone. The point is shifted by the exponent,
 * leading and trailing zeros dropped, and a zero carries no sign — the spelling `lib/decimal-input.ts` answers and the
 * api reads.
 *
 * `null` for anything that is not a number's text, and for an exponent no workbook writes — a double tops out near
 * `1E+308`, and an exponent past that would only ask this function to build a string of that many zeros.
 */
const NUMBER_TEXT = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u;
const NEGATIVE = /^-/u;
const LARGEST_EXPONENT = 400;

export function decimalOfNumberText(raw: string): string | null {
  const match = NUMBER_TEXT.exec(raw.trim());
  if (match === null) return null;
  const [, sign, whole, fraction = '', exponent = '0'] = match;
  const shift = Number(exponent);
  if (Math.abs(shift) > LARGEST_EXPONENT) return null;

  const digits = `${whole}${fraction}`;
  // Where the point falls in `digits` once the exponent has moved it — before the first digit, inside, or past the end.
  const point = whole.length + shift;
  const integer = point <= 0 ? '0' : digits.slice(0, point).padEnd(point, '0');
  const decimals = point <= 0 ? `${'0'.repeat(-point)}${digits}` : digits.slice(point);

  const trimmedInteger = integer.replace(/^0+(?=\d)/u, '');
  const trimmedDecimals = decimals.replace(/0+$/u, '');
  const value = trimmedDecimals === '' ? trimmedInteger : `${trimmedInteger}.${trimmedDecimals}`;
  return NEGATIVE.test(sign) && /[1-9]/u.test(value) ? `-${value}` : value;
}
