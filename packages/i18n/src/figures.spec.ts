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

  it('answers what is not a non-negative decimal as it was', () => {
    expect(roundHalfUp('-0.125', 2)).toBe('-0.125');
    expect(roundHalfUp('', 2)).toBe('');
  });
});
