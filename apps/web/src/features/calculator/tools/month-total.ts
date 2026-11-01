/**
 * The monthly form's running total and its gaps, as the reader types (task 39.1; §12.5.6's task-39 row (1)) — the
 * artboard's *"the expanded form totals for you and flags a missing month rather than quietly summing eleven"*.
 *
 * **A display, never the figure**: the server sums the months itself and stores that as the line's quantity, so this
 * total only says what the server is about to say. It is exact all the same — decimal strings added as scaled
 * `bigint`s — because a total that read `353.50000000000006` beside a bill would be the screen disagreeing with the
 * invoice. The input is the canonical form `parseDecimalInput` produces: digits, one optional dot, no sign.
 */
const DECIMAL = /^\d+(\.\d+)?$/u;

const scaled = (value: string, places: number): bigint => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(places, '0'));
};

/** The months entered, added exactly — `null` where none is, which is a line with no figure, never zero. */
export function monthTotal(months: readonly (string | null)[]): string | null {
  const entered = months.filter((month): month is string => month !== null && DECIMAL.test(month));
  if (entered.length === 0) return null;
  const places = Math.max(...entered.map((month) => month.split('.')[1]?.length ?? 0));
  const sum = entered.reduce((total, month) => total + scaled(month, places), 0n);
  if (places === 0) return sum.toString();
  const digits = sum.toString().padStart(places + 1, '0');
  const fraction = digits.slice(-places).replace(/0+$/u, '');
  const whole = digits.slice(0, -places);
  return fraction === '' ? whole : `${whole}.${fraction}`;
}

/** The positions — from zero — of the months left empty: what the line flags. */
export const missingMonths = (months: readonly (string | null)[]): readonly number[] =>
  months.flatMap((month, index) => (month === null ? [index] : []));
