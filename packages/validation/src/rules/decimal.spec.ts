import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  absoluteDecimal,
  addDecimals,
  compareDecimals,
  formatDecimal,
  isDecimalText,
  multiplyDecimals,
  readDecimal,
  subtractDecimals,
  ZERO,
  type Scaled,
} from './decimal.js';

const d = (text: string): Scaled => {
  const value = readDecimal(text);
  if (value === null) throw new Error(`not a decimal: ${text}`);
  return value;
};

describe('readDecimal', () => {
  it('reads the text PostgreSQL prints, signed', () => {
    expect(readDecimal('1700.50')).toEqual({ units: 170050n, places: 2 });
    expect(readDecimal('-3')).toEqual({ units: -3n, places: 0 });
    expect(readDecimal('0')).toEqual({ units: 0n, places: 0 });
  });

  it('refuses anything that is not a canonical decimal', () => {
    for (const text of ['', ' 1', '1 ', '+1', '1,5', '.5', '5.', '1e3', '1 700', '--1', 'NaN']) {
      expect(readDecimal(text), text).toBeNull();
      expect(isDecimalText(text), text).toBe(false);
    }
  });
});

describe('the arithmetic is exact', () => {
  it('adds across different numbers of places', () => {
    expect(formatDecimal(addDecimals(d('12.5'), d('7.25')))).toBe('19.75');
    expect(formatDecimal(addDecimals(d('0.1'), d('0.2')))).toBe('0.3');
  });

  it('subtracts into negative figures', () => {
    expect(formatDecimal(subtractDecimals(d('9'), d('20')))).toBe('-11');
    expect(formatDecimal(subtractDecimals(d('0.9'), d('0.6')))).toBe('0.3');
  });

  it('multiplies by a proportion, keeping every place', () => {
    expect(formatDecimal(multiplyDecimals(d('0.5'), d('0.6')))).toBe('0.3');
    expect(formatDecimal(multiplyDecimals(d('-1'), d('12.25')))).toBe('-12.25');
  });

  it('compares regardless of how many places each holds', () => {
    expect(compareDecimals(d('0.30'), d('0.3'))).toBe(0);
    expect(compareDecimals(d('-1'), d('0.5'))).toBe(-1);
    expect(compareDecimals(d('100.5'), d('100'))).toBe(1);
  });

  it('takes an absolute value', () => {
    expect(formatDecimal(absoluteDecimal(d('-11.5')))).toBe('11.5');
    expect(formatDecimal(absoluteDecimal(d('11.5')))).toBe('11.5');
  });
});

describe('formatDecimal', () => {
  it('writes canonical text: no trailing zeros, no -0, a leading zero kept', () => {
    expect(formatDecimal(d('-3.50'))).toBe('-3.5');
    expect(formatDecimal(d('2.000'))).toBe('2');
    expect(formatDecimal(subtractDecimals(d('1.5'), d('1.5')))).toBe('0');
    expect(formatDecimal(d('-0.05'))).toBe('-0.05');
    expect(formatDecimal(d('0.007'))).toBe('0.007');
  });
});

/**
 * **Exactness as a property** (task 212; NFR-88; §12.5.6's task-212 row). Each operand is generated as an integer and a
 * number of places, written out as text by this spec, and read by the module; the result is then read back as a
 * fraction and compared with the same operation on the operands' fractions, cross-multiplied in this spec's own
 * `bigint` arithmetic. So the oracle is a second calculation, not the module agreeing with itself. Seeded at task
 * 212's close: a comparison through floats broke the second property, on its nearly equal pairs, and a sum that
 * dropped places past the sixth broke the first and the last.
 *
 * **A fresh seed every run.** A failure prints its seed and the smallest case it shrank to; that case then joins the
 * examples above, so what it found stays tested whatever the next seed draws.
 */
describe('the arithmetic is exact, as a property (task 212)', () => {
  interface Parts {
    readonly units: bigint;
    readonly places: number;
  }

  const parts = fc.record({
    units: fc.bigInt({ min: -(10n ** 24n), max: 10n ** 24n }),
    places: fc.integer({ min: 0, max: 12 }),
  });

  /** The text an operand travels in, written here rather than by `formatDecimal` — trailing zeros kept, as stored. */
  const textOf = ({ units, places }: Parts): string => {
    const digits = (units < 0n ? -units : units).toString().padStart(places + 1, '0');
    const whole = digits.slice(0, digits.length - places);
    const magnitude = places === 0 ? whole : `${whole}.${digits.slice(digits.length - places)}`;
    return units < 0n ? `-${magnitude}` : magnitude;
  };

  const read = (operand: Parts): Scaled => d(textOf(operand));
  const scale = (places: number): bigint => 10n ** BigInt(places);

  /** `value` denotes the fraction `numerator / denominator`, the denominator positive. */
  const denotes = (value: Scaled, numerator: bigint, denominator: bigint): boolean =>
    value.units * denominator === numerator * scale(value.places);

  it('adds, subtracts and multiplies to exactly the fraction the operands make', () => {
    fc.assert(
      fc.property(parts, parts, (left, right) => {
        const denominator = scale(left.places) * scale(right.places);
        const crossed = (sign: bigint) => left.units * scale(right.places) + sign * right.units * scale(left.places);
        expect(denotes(addDecimals(read(left), read(right)), crossed(1n), denominator)).toBe(true);
        expect(denotes(subtractDecimals(read(left), read(right)), crossed(-1n), denominator)).toBe(true);
        expect(denotes(multiplyDecimals(read(left), read(right)), left.units * right.units, denominator)).toBe(true);
        const magnitude = left.units < 0n ? -left.units : left.units;
        expect(denotes(absoluteDecimal(read(left)), magnitude, scale(left.places))).toBe(true);
      }),
    );
  });

  /**
   * Two operands drawn apart, or **nearly equal** — the same value written with more places, or one unit of its last
   * place away. A comparison defect lives there: two random 24-digit figures differ in their first sixteen digits, so
   * a comparison through floats gives the right sign for them, and only a near pair shows it does not.
   */
  const pairs = fc.oneof(
    fc.tuple(parts, parts),
    fc
      .tuple(parts, fc.integer({ min: 0, max: 6 }), fc.constantFrom(-1n, 0n, 1n))
      .map(([left, extra, step]): [Parts, Parts] => [
        left,
        { units: left.units * 10n ** BigInt(extra) + step, places: left.places + extra },
      ]),
  );

  it('compares as the fractions compare, nearly equal ones included', () => {
    fc.assert(
      fc.property(pairs, ([left, right]) => {
        const difference = left.units * scale(right.places) - right.units * scale(left.places);
        const expected = difference === 0n ? 0 : difference < 0n ? -1 : 1;
        expect(compareDecimals(read(left), read(right))).toBe(expected);
      }),
    );
  });

  it('writes canonical text that reads back as the same value', () => {
    fc.assert(
      fc.property(parts, (operand) => {
        const text = formatDecimal(read(operand));
        // Zero, or a magnitude that is not zero with its sign: no leading or trailing zeros, and never `-0`.
        expect(text).toMatch(/^(0|-?(0\.\d*[1-9]|[1-9]\d*(\.\d*[1-9])?))$/u);
        expect(denotes(d(text), operand.units, scale(operand.places))).toBe(true);
      }),
    );
  });

  it('sums a list to the same total whatever order it is added in', () => {
    const listAndReordering = fc
      .array(parts, { maxLength: 12 })
      .chain((list) => fc.tuple(fc.constant(list), fc.shuffledSubarray(list, { minLength: list.length })));
    const total = (list: readonly Parts[]): string =>
      formatDecimal(list.reduce<Scaled>((sum, operand) => addDecimals(sum, read(operand)), ZERO));
    fc.assert(
      fc.property(listAndReordering, ([list, reordered]) => {
        expect(total(reordered)).toBe(total(list));
      }),
    );
  });
});
