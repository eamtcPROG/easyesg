import { isDecimalString } from './decimal-string';

/**
 * Exact arithmetic over decimal strings — the two operations the emissions calculation needs (task 38.2; §7.9,
 * NFR-19).
 *
 * **Exact, not floating point, and it can be because nothing here divides.** A figure is a quantity times a unit's
 * MWh times a factor, summed over lines: products and sums of finite decimals are finite decimals, so a `bigint`
 * scaled by a power of ten represents every intermediate without loss. Floats would not — `0.1 + 0.2` is the
 * classic, and the calculator's own `500 × 0.0095773` is another — and a figure a filing carries would then hold
 * binary noise in its last places. NFR-19 asks a stored calculation to reproduce *exactly*; exact arithmetic makes that
 * a property of the numbers rather than of the runtime. `derivation.model.ts`'s rates divide and so cannot be exact;
 * this is the case where exactness costs nothing.
 *
 * **No rounding anywhere**: the unrounded value is the one kept (S-09's *"the unrounded value is kept"*), and a figure
 * is rounded once, at presentation.
 */

/** A decimal as an integer and a count of decimal places: `12.50` is `{ units: 1250n, places: 2 }`. */
interface Scaled {
  readonly units: bigint;
  readonly places: number;
}

const parse = (value: string): Scaled => {
  if (!isDecimalString(value)) throw new RangeError(`Not a decimal string: ${JSON.stringify(value)}`);
  const [whole, fraction = ''] = value.split('.');
  return { units: BigInt(whole + fraction), places: fraction.length };
};

/** Back to the canonical string — no trailing fractional zeros, `0` for zero — which `isDecimalString` accepts. */
const format = ({ units, places }: Scaled): string => {
  const digits = units.toString().padStart(places + 1, '0');
  const whole = digits.slice(0, digits.length - places);
  const fraction = digits.slice(digits.length - places).replace(/0+$/, '');
  return fraction === '' ? whole : `${whole}.${fraction}`;
};

const rescale = (value: Scaled, places: number): bigint => value.units * 10n ** BigInt(places - value.places);

export function multiplyDecimals(left: string, right: string): string {
  const a = parse(left);
  const b = parse(right);
  return format({ units: a.units * b.units, places: a.places + b.places });
}

export function addDecimals(left: string, right: string): string {
  const a = parse(left);
  const b = parse(right);
  const places = Math.max(a.places, b.places);
  return format({ units: rescale(a, places) + rescale(b, places), places });
}

/** The sum of any number of decimals, `0` for none. */
export const sumDecimals = (values: readonly string[]): string => values.reduce(addDecimals, '0');
