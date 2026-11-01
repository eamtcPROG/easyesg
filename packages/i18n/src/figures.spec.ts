import { describe, expect, it } from 'vitest';
import { roundHalfUp } from './figures.js';

describe('roundHalfUp (task 39.2; shared since task 43)', () => {
  it('rounds half-up in decimal, never through a float', () => {
    // 0.125 and 2.675 are not what they look like as binary floats; as decimals they round up.
    expect(roundHalfUp('0.125', 2)).toBe('0.13');
    expect(roundHalfUp('2.675', 2)).toBe('2.68');
    expect(roundHalfUp('0.9699123256', 2)).toBe('0.97');
    expect(roundHalfUp('0.994', 2)).toBe('0.99');
    expect(roundHalfUp('9.995', 2)).toBe('10.00');
    expect(roundHalfUp('353.5', 0)).toBe('354');
  });

  it('leaves a figure with no more places than asked as it is', () => {
    expect(roundHalfUp('17000', 2)).toBe('17000');
    expect(roundHalfUp('0.5', 2)).toBe('0.5');
  });

  it('rounds a signed figure’s magnitude, half away from zero, as Intl’s halfExpand does (task 211)', () => {
    // B10's pay gap is kept signed: where the women's pay exceeds the men's, the gap is negative.
    expect(roundHalfUp('-0.125', 2)).toBe('-0.13');
    expect(roundHalfUp('-0.0526315789', 4)).toBe('-0.0526');
    expect(roundHalfUp('-2.5', 0)).toBe('-3');
    expect(new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format('-0.125' as Intl.StringNumericLiteral)).toBe(
      '-0.13',
    );
  });

  it('gives a figure that rounds to nothing no sign', () => {
    expect(roundHalfUp('-0.001', 2)).toBe('0.00');
    expect(roundHalfUp('-0.4', 0)).toBe('0');
  });

  it('answers what is not a decimal as it was', () => {
    expect(roundHalfUp('', 2)).toBe('');
    expect(roundHalfUp('1e-7', 2)).toBe('1e-7');
    expect(roundHalfUp('--1.25', 1)).toBe('--1.25');
  });
});
