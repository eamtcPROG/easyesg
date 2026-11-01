import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, readPageSize, toPageSize } from './page-size';

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

/** The other narrowing: a size a view holds, never absent — a tenant list's view and its pager both need one. */
describe('toPageSize', () => {
  it('keeps an offered size, the default included', () => {
    expect(toPageSize('50')).toBe(50);
    expect(toPageSize(100)).toBe(100);
    expect(toPageSize('25')).toBe(25);
  });

  it('falls back to the default for a size not offered or unreadable', () => {
    for (const raw of ['-1', '200', 'many', undefined, null]) expect(toPageSize(raw)).toBe(DEFAULT_PAGE_SIZE);
  });
});
