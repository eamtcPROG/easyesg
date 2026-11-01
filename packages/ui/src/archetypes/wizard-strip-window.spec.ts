import { describe, expect, it } from 'vitest';
import { stripWindow } from './wizard-strip-window';

describe('stripWindow', () => {
  it('shows every step when they all fit, with nothing behind the +n', () => {
    expect(stripWindow({ count: 5, current: 4, size: 6 })).toEqual({ start: 0, end: 5, hidden: 0 });
  });

  it('starts at the first step while the current one fits — the artboard’s B1 … B6 · +5', () => {
    expect(stripWindow({ count: 11, current: 0, size: 6 })).toEqual({ start: 0, end: 6, hidden: 5 });
    expect(stripWindow({ count: 11, current: 4, size: 6 })).toEqual({ start: 0, end: 6, hidden: 5 });
  });

  it('slides so the current step keeps one step after it', () => {
    // B6 current: B2 … B7, B7 the step after it.
    expect(stripWindow({ count: 11, current: 5, size: 6 })).toEqual({ start: 1, end: 7, hidden: 5 });
  });

  it('stops at the last step, keeping the current one inside', () => {
    const window = stripWindow({ count: 11, current: 10, size: 6 });

    expect(window).toEqual({ start: 5, end: 11, hidden: 5 });
    expect(10).toBeGreaterThanOrEqual(window.start);
    expect(10).toBeLessThan(window.end);
  });

  it('holds the current step inside the window at every position of a twenty-step report', () => {
    for (let current = 0; current < 20; current += 1) {
      const window = stripWindow({ count: 20, current, size: 6 });
      expect(current).toBeGreaterThanOrEqual(window.start);
      expect(current).toBeLessThan(window.end);
      expect(window.end - window.start).toBe(6);
    }
  });

  it('starts at the first step when no step is current', () => {
    expect(stripWindow({ count: 11, current: -1, size: 6 })).toEqual({ start: 0, end: 6, hidden: 5 });
  });
});
