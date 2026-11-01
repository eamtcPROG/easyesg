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
