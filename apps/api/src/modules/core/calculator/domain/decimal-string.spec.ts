import { isDecimalString, isPositiveDecimalString } from './decimal-string';

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
