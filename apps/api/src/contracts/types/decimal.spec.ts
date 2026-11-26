import fc from 'fast-check';
import {
  addDecimals,
  divideDecimals,
  isDecimalString,
  isPositiveDecimalString,
  multiplyDecimals,
  sumDecimals,
} from './decimal';

/**
 * The decimal-string vocabulary and its arithmetic (tasks 37, 38.2, 38.4). **The expected figures in the division
 * cases were computed outside this code**, with Python's `decimal` at sixty digits and `ROUND_HALF_UP`, so each is a
 * second calculation agreeing with the first.
 */
describe('decimal strings', () => {
  it.each(['0', '500', '1700.5', '0.000512', '11.2222'])('accepts %s', (value) => {
    expect(isDecimalString(value)).toBe(true);
  });

  it.each([
    ['a number', 500],
    ['a sign', '-1'],
    ['an exponent', '5e2'],
    ['a thousands space', '1 700'],
    ['a decimal comma', '1700,5'],
    ['a leading zero', '0500'],
    ['a bare point', '.5'],
    ['an empty string', ''],
  ])('refuses %s', (_case, value) => {
    expect(isDecimalString(value)).toBe(false);
  });

  it('counts zero as a decimal and not as a positive one', () => {
    expect(isDecimalString('0.000')).toBe(true);
    expect(isPositiveDecimalString('0.000')).toBe(false);
    expect(isPositiveDecimalString('0.001')).toBe(true);
  });
});

describe('exact decimal arithmetic', () => {
  it('multiplies without binary noise', () => {
    // As floats: 500 * 0.0095773 = 4.7886500000000005.
    expect(multiplyDecimals('500', '0.0095773')).toBe('4.78865');
    expect(multiplyDecimals('4.78865', '0.202544')).toBe('0.9699123256');
  });

  it('adds without binary noise', () => {
    // As floats: 0.1 + 0.2 = 0.30000000000000004.
    expect(addDecimals('0.1', '0.2')).toBe('0.3');
    expect(addDecimals('1.5', '2')).toBe('3.5');
  });

  it('answers the canonical form: no trailing zeros, and zero as `0`', () => {
    expect(multiplyDecimals('2.50', '4')).toBe('10');
    expect(multiplyDecimals('0', '0.594645')).toBe('0');
    expect(addDecimals('0.000', '0')).toBe('0');
    expect(multiplyDecimals('0.001', '0.001')).toBe('0.000001');
  });

  it('sums any number of decimals, and none as zero', () => {
    expect(sumDecimals(['0.95', '0.84', '0.000001'])).toBe('1.790001');
    expect(sumDecimals([])).toBe('0');
  });

  it('refuses a value that is not a decimal string, rather than computing with it', () => {
    expect(() => multiplyDecimals('1e3', '2')).toThrow(RangeError);
    expect(() => addDecimals('-1', '2')).toThrow(RangeError);
  });
});

describe('divideDecimals', () => {
  const ten = { significantFigures: 10 };

  it('keeps ten significant figures of a tiny intensity, whatever its scale', () => {
    // 2.23 t over 5 million lei — the figure a small bakery's B3 intensity is.
    expect(divideDecimals('2.2310228478832', '5000000', ten)).toBe('0.0000004462045696');
    expect(divideDecimals('17.5420275', '1250000.50', ten)).toBe('0.00001403361639');
  });

  it('rounds half-up on the first dropped digit', () => {
    expect(divideDecimals('1', '3', ten)).toBe('0.3333333333');
    expect(divideDecimals('2', '3', ten)).toBe('0.6666666667');
    expect(divideDecimals('1', '8', { significantFigures: 2 })).toBe('0.13');
  });

  it('rounds a large quotient to whole digits, carrying into a new one where it must', () => {
    expect(divideDecimals('123456789012', '1', ten)).toBe('123456789000');
    expect(divideDecimals('99999999995', '10', ten)).toBe('10000000000');
  });

  it('answers an exact quotient exactly, and zero as `0`', () => {
    expect(divideDecimals('10', '4', ten)).toBe('2.5');
    expect(divideDecimals('0', '7', ten)).toBe('0');
  });

  it('answers no ratio for a zero denominator, rather than an infinite one', () => {
    expect(divideDecimals('5', '0', ten)).toBeNull();
    expect(divideDecimals('5', '0.00', ten)).toBeNull();
  });
});

/**
 * **Exactness, and division's one rounding, as properties** (task 212; NFR-88's calculator; §12.5.6's task-212 row).
 * Each operand is generated as an integer and a number of places and written out as text by this spec; each result is
 * read back as a fraction and compared, cross-multiplied in this spec's own `bigint` arithmetic, with what the operands'
 * fractions make — a second calculation rather than the module agreeing with itself.
 *
 * **Division is held to the task-38.4 row's rule rather than to one answer**: the quotient is a whole number of units
 * of its last kept significant figure, it lies within half such a unit of the exact quotient, and where it lies exactly
 * half a unit away it is the larger — half-up. Truncating instead, rounding half-down and keeping one figure too many
 * were each seeded at task 212's close, and each broke it.
 *
 * **A fresh seed every run.** A failure prints its seed and the smallest case it reached; that case then joins the
 * examples above, so what it found stays tested whatever the next seed draws.
 */
describe('decimal arithmetic, as properties (task 212)', () => {
  interface Parts {
    readonly units: bigint;
    readonly places: number;
  }
  /** `numerator / denominator`, the denominator positive. */
  interface Fraction {
    readonly numerator: bigint;
    readonly denominator: bigint;
  }

  const parts = fc.record({
    units: fc.bigInt({ min: 0n, max: 10n ** 24n }),
    places: fc.integer({ min: 0, max: 12 }),
  });

  /** The text an operand travels in, written here — trailing fractional zeros kept, as a screen may send them. */
  const textOf = ({ units, places }: Parts): string => {
    const digits = units.toString().padStart(places + 1, '0');
    const whole = digits.slice(0, digits.length - places);
    return places === 0 ? whole : `${whole}.${digits.slice(digits.length - places)}`;
  };

  const tenTo = (power: number): Fraction =>
    power >= 0 ? { numerator: 10n ** BigInt(power), denominator: 1n } : { numerator: 1n, denominator: 10n ** BigInt(-power) };
  const fractionOfParts = ({ units, places }: Parts): Fraction => ({ numerator: units, denominator: tenTo(places).numerator });
  const fractionOf = (text: string): Fraction => {
    const [whole, fraction = ''] = text.split('.');
    return fractionOfParts({ units: BigInt(`${whole}${fraction}`), places: fraction.length });
  };
  const sum = (left: Fraction, right: Fraction): Fraction => ({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
  const product = (left: Fraction, right: Fraction): Fraction => ({
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  });
  const negated = (value: Fraction): Fraction => ({ numerator: -value.numerator, denominator: value.denominator });
  /** Negative, zero or positive as `left` is below, equal to or above `right`. */
  const compare = (left: Fraction, right: Fraction): number => {
    const difference = left.numerator * right.denominator - right.numerator * left.denominator;
    return difference === 0n ? 0 : difference < 0n ? -1 : 1;
  };

  /** The canonical form the module promises: a decimal string with no trailing fractional zero. */
  const canonical = (text: string): boolean => isDecimalString(text) && !/\.\d*0$/.test(text);

  it('adds and multiplies to exactly the fraction the operands make, in canonical form', () => {
    fc.assert(
      fc.property(parts, parts, (left, right) => {
        const added = addDecimals(textOf(left), textOf(right));
        const multiplied = multiplyDecimals(textOf(left), textOf(right));
        return (
          canonical(added) &&
          canonical(multiplied) &&
          compare(fractionOf(added), sum(fractionOfParts(left), fractionOfParts(right))) === 0 &&
          compare(fractionOf(multiplied), product(fractionOfParts(left), fractionOfParts(right))) === 0
        );
      }),
    );
  });

  it('sums a list of lines to the same total whatever order the lines come in', () => {
    const listAndReordering = fc
      .array(parts.map(textOf), { maxLength: 12 })
      .chain((list) => fc.tuple(fc.constant(list), fc.shuffledSubarray(list, { minLength: list.length })));
    fc.assert(fc.property(listAndReordering, ([list, reordered]) => sumDecimals(reordered) === sumDecimals(list)));
  });

  /** Whether `quotient` is `numerator ÷ denominator` rounded half-up to `significantFigures`, by the three tests above. */
  const roundsAsTheRuleSays = (input: {
    readonly quotient: string;
    readonly exact: Fraction;
    readonly significantFigures: number;
  }): boolean => {
    const { quotient, exact, significantFigures } = input;
    // The power of ten of the exact quotient's first figure, and so of the last one kept.
    let first = exact.numerator.toString().length - exact.denominator.toString().length;
    while (compare(tenTo(first), exact) > 0) first -= 1;
    while (compare(tenTo(first + 1), exact) <= 0) first += 1;
    const lastKept = first - significantFigures + 1;

    const result = fractionOf(quotient);
    const inUnits = product(result, tenTo(-lastKept));
    const error = sum(result, negated(exact));
    const distance = error.numerator < 0n ? negated(error) : error;
    const fromHalf = compare(distance, product({ numerator: 1n, denominator: 2n }, tenTo(lastKept)));
    return (
      inUnits.numerator % inUnits.denominator === 0n && (fromHalf < 0 || (fromHalf === 0 && error.numerator > 0n))
    );
  };

  it('divides to within half a unit of the last figure it keeps, an exact half rounding up', () => {
    fc.assert(
      fc.property(parts, parts, fc.integer({ min: 1, max: 20 }), (top, bottom, significantFigures) => {
        const quotient = divideDecimals(textOf(top), textOf(bottom), { significantFigures });
        if (bottom.units === 0n) return quotient === null;
        if (top.units === 0n) return quotient === '0';
        const exact: Fraction = {
          numerator: top.units * tenTo(bottom.places).numerator,
          denominator: bottom.units * tenTo(top.places).numerator,
        };
        return quotient !== null && canonical(quotient) && roundsAsTheRuleSays({ quotient, exact, significantFigures });
      }),
      // A failure here turns on one digit deep inside a large quotient, so shrinking it towards small operands can
      // wander for minutes. Past five seconds the run stops and reports the smallest case it reached — a healthy run
      // takes milliseconds, so the limit only ever cuts a shrink short.
      { interruptAfterTimeLimit: 5_000 },
    );
  });
});
