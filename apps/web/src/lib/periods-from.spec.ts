import { describe, expect, it } from 'vitest';
import { readPeriodsFrom } from './periods-from';

/** The origin read from the address (30 Sep 2026) — one of three, or nothing; a path is never one of them. */
describe('readPeriodsFrom', () => {
  it('reads each of the three origins', () => {
    expect(readPeriodsFrom('entities')).toBe('entities');
    expect(readPeriodsFrom('entity')).toBe('entity');
    expect(readPeriodsFrom('new-report')).toBe('new-report');
  });

  it('answers nothing for an absent, repeated or foreign value — a path above all', () => {
    expect(readPeriodsFrom(undefined)).toBeNull();
    expect(readPeriodsFrom(['entities', 'entity'])).toBeNull();
    expect(readPeriodsFrom('https://example.com/phish')).toBeNull();
    expect(readPeriodsFrom('/entities')).toBeNull();
  });
});
