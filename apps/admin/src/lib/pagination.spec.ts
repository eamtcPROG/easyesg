import { describe, expect, it } from 'vitest';
import { readPageSize } from './pagination';

describe('readPageSize', () => {
  it('keeps an offered size that is not the default', () => {
    expect(readPageSize('50')).toEqual({ onpage: 50 });
    expect(readPageSize(100)).toEqual({ onpage: 100 });
  });

  it('never writes the default, so one view keeps one address', () => {
    expect(readPageSize('25')).toEqual({});
  });

  /** `-1` is the api's "all rows", which no console list offers. */
  it('drops a size that is not offered, and anything unreadable', () => {
    expect(readPageSize('-1')).toEqual({});
    expect(readPageSize('200')).toEqual({});
    expect(readPageSize('many')).toEqual({});
    expect(readPageSize(undefined)).toEqual({});
  });
});
