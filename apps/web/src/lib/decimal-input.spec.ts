import { describe, expect, it } from 'vitest';
import { parseDecimalInput } from './decimal-input';

describe('parseDecimalInput', () => {
  it('reads the separators a Moldovan reader types and answers the wire form', () => {
    expect(parseDecimalInput('1 240,50')).toEqual({ value: '1240.50' });
    expect(parseDecimalInput('1240.5')).toEqual({ value: '1240.5' });
    expect(parseDecimalInput('-3')).toEqual({ value: '-3' });
    expect(parseDecimalInput(' 42 ')).toEqual({ value: '42' });
  });

  it('treats empty as clearing, and refuses what is not a number', () => {
    expect(parseDecimalInput('')).toEqual({ value: null });
    expect(parseDecimalInput('   ')).toEqual({ value: null });
    expect(parseDecimalInput('1,2,3')).toEqual({ invalid: true });
    expect(parseDecimalInput('abc')).toEqual({ invalid: true });
    expect(parseDecimalInput('-')).toEqual({ invalid: true });
  });
});
