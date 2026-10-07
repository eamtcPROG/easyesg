import { describe, expect, it } from 'vitest';
import { parseDecimalInput } from './decimal-input';

describe('parseDecimalInput', () => {
  it('reads the separators a Moldovan reader types and answers the wire form', () => {
    expect(parseDecimalInput('1 240,50')).toEqual({ value: '1240.50' });
    expect(parseDecimalInput('1240.5')).toEqual({ value: '1240.5' });
    expect(parseDecimalInput('-3')).toEqual({ value: '-3' });
    expect(parseDecimalInput(' 42 ')).toEqual({ value: '42' });
  });

  it('answers the one spelling the api reads: no leading zero before a digit, no bare point, no signed zero', () => {
    expect(parseDecimalInput('0500')).toEqual({ value: '500' });
    expect(parseDecimalInput('12,')).toEqual({ value: '12' });
    expect(parseDecimalInput(',5')).toEqual({ value: '0.5' });
    expect(parseDecimalInput('007,10')).toEqual({ value: '7.10' });
    expect(parseDecimalInput('0')).toEqual({ value: '0' });
    expect(parseDecimalInput('0,0')).toEqual({ value: '0.0' });
    expect(parseDecimalInput('-0')).toEqual({ value: '0' });
    expect(parseDecimalInput('-0,5')).toEqual({ value: '-0.5' });
  });

  it('treats empty as clearing, and refuses what is not a number', () => {
    expect(parseDecimalInput('')).toEqual({ value: null });
    expect(parseDecimalInput('   ')).toEqual({ value: null });
    expect(parseDecimalInput('1,2,3')).toEqual({ invalid: true });
    expect(parseDecimalInput('abc')).toEqual({ invalid: true });
    expect(parseDecimalInput('-')).toEqual({ invalid: true });
    expect(parseDecimalInput(',')).toEqual({ invalid: true });
    expect(parseDecimalInput('1e3')).toEqual({ invalid: true });
  });
});
