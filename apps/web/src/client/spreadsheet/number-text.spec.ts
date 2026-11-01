import { describe, expect, it } from 'vitest';
import { decimalOfNumberText } from './number-text';

describe('decimalOfNumberText', () => {
  it('keeps a plain number’s digits as they are stored', () => {
    expect(decimalOfNumberText('1700')).toBe('1700');
    expect(decimalOfNumberText('1700.5')).toBe('1700.5');
    expect(decimalOfNumberText('0.84')).toBe('0.84');
    // A double's stored text, digit for digit — what the workbook holds is what is imported.
    expect(decimalOfNumberText('0.30000000000000004')).toBe('0.30000000000000004');
  });

  it('moves the point by the exponent, either way, without a float', () => {
    expect(decimalOfNumberText('1.5E-3')).toBe('0.0015');
    expect(decimalOfNumberText('15E-1')).toBe('1.5');
    expect(decimalOfNumberText('1E+21')).toBe('1000000000000000000000');
    expect(decimalOfNumberText('1.234e2')).toBe('123.4');
    expect(decimalOfNumberText('9.99e-1')).toBe('0.999');
  });

  it('spells it the one way the api reads: no leading or trailing zeros, and a zero has no sign', () => {
    expect(decimalOfNumberText('0500')).toBe('500');
    expect(decimalOfNumberText('12.500')).toBe('12.5');
    expect(decimalOfNumberText('2.0')).toBe('2');
    expect(decimalOfNumberText('0')).toBe('0');
    expect(decimalOfNumberText('-0')).toBe('0');
    expect(decimalOfNumberText('0E+5')).toBe('0');
    expect(decimalOfNumberText('-3')).toBe('-3');
    expect(decimalOfNumberText('+3')).toBe('3');
  });

  it('answers nothing for text that is not a number, or an exponent no workbook writes', () => {
    expect(decimalOfNumberText('Gaz')).toBeNull();
    expect(decimalOfNumberText('1 700')).toBeNull();
    expect(decimalOfNumberText('1,5')).toBeNull();
    expect(decimalOfNumberText('')).toBeNull();
    expect(decimalOfNumberText('1E+99999')).toBeNull();
  });
});
