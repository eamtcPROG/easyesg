import { describe, expect, it } from 'vitest';
import { PAGE_GAP, pageWindow } from './pagination-window';

describe('pageWindow', () => {
  it('draws every page when there are few enough', () => {
    expect(pageWindow({ current: 1, pages: 1 })).toEqual([1]);
    expect(pageWindow({ current: 4, pages: 7 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the first, the last, and the current page with its neighbours', () => {
    expect(pageWindow({ current: 10, pages: 20 })).toEqual([1, PAGE_GAP, 9, 10, 11, PAGE_GAP, 20]);
  });

  it('draws a single skipped page rather than a gap standing for it', () => {
    expect(pageWindow({ current: 4, pages: 20 })).toEqual([1, 2, 3, 4, 5, PAGE_GAP, 20]);
    expect(pageWindow({ current: 17, pages: 20 })).toEqual([1, PAGE_GAP, 16, 17, 18, 19, 20]);
  });

  it('never draws a page outside the range at either end', () => {
    expect(pageWindow({ current: 1, pages: 20 })).toEqual([1, 2, PAGE_GAP, 20]);
    expect(pageWindow({ current: 20, pages: 20 })).toEqual([1, PAGE_GAP, 19, 20]);
  });
});
