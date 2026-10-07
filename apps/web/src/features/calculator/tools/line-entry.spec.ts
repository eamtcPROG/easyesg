import { describe, expect, it } from 'vitest';
import { LINE_ENTRY, storedEntry } from './line-entry';

describe('storedEntry (task 39.1)', () => {
  it('reads the entry a line is stored in', () => {
    expect(storedEntry({ notAvailableReason: null, monthlyQuantities: null })).toBe(LINE_ENTRY.FIGURE);
    expect(storedEntry({ notAvailableReason: null, monthlyQuantities: ['1', null] })).toBe(LINE_ENTRY.MONTHS);
    expect(storedEntry({ notAvailableReason: 'Billed by the landlord', monthlyQuantities: null })).toBe(LINE_ENTRY.REASON);
  });
});
