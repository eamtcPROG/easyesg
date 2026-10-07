/**
 * Exact arithmetic over the decimal strings a stored figure travels in (task 40; §7.9, NFR-58) — what a `sum` rule
 * adds and what the year-over-year rule compares, with no float between.
 *
 * **Why not `Number`.** A sum of `0.1` and `0.2` is `0.30000000000000004` as a float, so a split that is exactly its
 * total would read as inconsistent, and the template compares exactly (`architecture.md` §12.5.6's task-40 row (3)).
 * A `bigint` scaled by a power of ten holds every sum, difference and product of finite decimals without loss, and
 * behaves identically in the api's runtime and the browser's — which a verdict that must agree in both needs.
 *
 * **Signed, unlike the api's calculator arithmetic** (`apps/api/src/contracts/types/decimal.ts`), because a disclosure
 * may hold a negative figure and a range rule exists to say so. Private to the interpreter: the package's charter is
 * validation evaluated identically in two runtimes, not a general arithmetic library (§9.8).
 */

/** The text PostgreSQL's `numeric` prints and a rule's bounds are written in: an optional minus, digits, a point. */
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/u;

/** A decimal as an integer and a count of decimal places: `-12.50` is `{ units: -1250n, places: 2 }`. */
export interface Scaled {
  readonly units: bigint;
  readonly places: number;
}

/** `null` for anything that is not a decimal's canonical text — a figure the rule then has no number for. */
export function readDecimal(text: string): Scaled | null {
  const match = DECIMAL.exec(text);
  if (match === null) return null;
  const [, sign, whole, fraction = ''] = match;
  const units = BigInt(`${whole}${fraction}`);
  return { units: sign === '' ? units : -units, places: fraction.length };
}

export const isDecimalText = (text: string): boolean => readDecimal(text) !== null;

export const ZERO: Scaled = { units: 0n, places: 0 };

const atPlaces = (value: Scaled, places: number): bigint => value.units * 10n ** BigInt(places - value.places);

export function addDecimals(left: Scaled, right: Scaled): Scaled {
  const places = Math.max(left.places, right.places);
  return { units: atPlaces(left, places) + atPlaces(right, places), places };
}

export const subtractDecimals = (left: Scaled, right: Scaled): Scaled =>
  addDecimals(left, { units: -right.units, places: right.places });

export const multiplyDecimals = (left: Scaled, right: Scaled): Scaled => ({
  units: left.units * right.units,
  places: left.places + right.places,
});

export const absoluteDecimal = (value: Scaled): Scaled => ({
  units: value.units < 0n ? -value.units : value.units,
  places: value.places,
});

/** Negative, zero or positive as `left` is below, equal to or above `right`. */
export function compareDecimals(left: Scaled, right: Scaled): number {
  const places = Math.max(left.places, right.places);
  const difference = atPlaces(left, places) - atPlaces(right, places);
  if (difference === 0n) return 0;
  return difference < 0n ? -1 : 1;
}

/**
 * Back to canonical text — no trailing fractional zeros, `0` for zero and never `-0` — which is what a finding quotes
 * and what the reader's locale formats (NFR-26).
 */
export function formatDecimal(value: Scaled): string {
  const negative = value.units < 0n;
  const digits = (negative ? -value.units : value.units).toString().padStart(value.places + 1, '0');
  const whole = digits.slice(0, digits.length - value.places);
  const fraction = digits.slice(digits.length - value.places).replace(/0+$/u, '');
  const magnitude = fraction === '' ? whole : `${whole}.${fraction}`;
  return negative ? `-${magnitude}` : magnitude;
}
