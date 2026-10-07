import { describe, expect, it } from 'vitest';
import { readFigure } from './figure-input';

describe('readFigure (task 39.1)', () => {
  it('reads a bill’s figure as a Moldovan reader types it', () => {
    expect(readFigure('1 700')).toEqual({ value: '1700' });
    expect(readFigure('1700,5')).toEqual({ value: '1700.5' });
    expect(readFigure('')).toEqual({ value: null });
  });

  it('refuses a negative figure and anything that is not a number', () => {
    expect(readFigure('-5')).toEqual({ invalid: true });
    expect(readFigure('five')).toEqual({ invalid: true });
  });
});
