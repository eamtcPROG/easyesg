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
