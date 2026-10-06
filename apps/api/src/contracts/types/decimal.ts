/**
 * Decimal strings — the one shape a `numeric` travels in (§7.9, NFR-58, AD-14 constraint 4) — and the arithmetic
 * over them that the emissions figures need.
 *
 * **Here, beside `time.ts`'s `isIanaTimeZone`, because two modules read it** (task 38.4): the carbon calculator's
 * factors, quantities and scope totals (tasks 37, 38.1 … 38.3), and the disclosure store's derived B3 total and
 * intensity. It moved out of `core/calculator/domain/` the day the second reader arrived, by `time.ts`'s own rule —
 * an operation over a shared representation lives beside it, not in whichever module needed it first.
 *
 * **Exact where it can be.** Products and sums of finite decimals are finite decimals, so a `bigint` scaled by a power
 * of ten represents every intermediate of a quantity × conversion × factor, summed over lines, without loss — floats
 * would not (`500 × 0.0095773` is `4.7886500000000005`), and a filed figure would carry the noise. **Division is the
 * one operation that cannot be exact**, so it rounds, once, to a stated number of significant figures, half-up
 * (§12.5.6's task-38.4 row). Nothing else here rounds: an unrounded figure is the one kept, and presentation rounds.
 *
 * Non-negative only — no sign, no exponent, no thousands separator. A screen accepts `1 700` and `1.700` as typed
 * (S-09's artboard) and sends the canonical form.
 */
const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;

export const isDecimalString = (value: unknown): value is string => typeof value === 'string' && DECIMAL.test(value);

/** Greater than zero as well — a conversion to no energy at all is a mistyped factor, never a real one. */
export const isPositiveDecimalString = (value: unknown): value is string =>
  isDecimalString(value) && /[1-9]/.test(value);

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

/**
 * Back to the canonical string — no trailing fractional zeros, `0` for zero — which `isDecimalString` accepts. A
 * negative count of places is a whole number with that many zeros, which a rounded division of a large figure yields.
 */
const format = ({ units, places }: Scaled): string => {
  if (places < 0) return (units * 10n ** BigInt(-places)).toString();
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

/**
 * `numerator ÷ denominator`, rounded half-up to `significantFigures` — scale-free, so a GHG intensity of
 * 0.000000446… keeps as many meaningful digits as one of 446…. `null` for a zero denominator, which is no ratio rather
 * than an infinite one.
 *
 * **Half-up on the first dropped digit**, which is the whole rule: a tail of `5` or more rounds away from zero
 * whatever follows it, so the remainder past that digit never needs inspecting.
 */
export function divideDecimals(
  numerator: string,
  denominator: string,
  rounding: { readonly significantFigures: number },
): string | null {
  const a = parse(numerator);
  const b = parse(denominator);
  if (b.units === 0n) return null;
  if (a.units === 0n) return '0';

  // The quotient is (a.units / b.units) × 10^(b.places − a.places). Scaled by 10^extra so the integer division keeps
  // at least one digit beyond the precision asked for — the guard digit the rounding reads.
  const wanted = rounding.significantFigures;
  const extra = Math.max(0, wanted + 1 - (a.units.toString().length - b.units.toString().length));
  const quotient = (a.units * 10n ** BigInt(extra)) / b.units;

  const drop = quotient.toString().length - wanted;
  const kept = drop > 0 ? quotient / 10n ** BigInt(drop) : quotient;
  const roundsUp = drop > 0 && (quotient / 10n ** BigInt(drop - 1)) % 10n >= 5n;
  return format({
    units: roundsUp ? kept + 1n : kept,
    places: extra + a.places - b.places - Math.max(drop, 0),
  });
}
