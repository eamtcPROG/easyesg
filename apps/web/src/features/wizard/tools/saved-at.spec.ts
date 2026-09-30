import type { DisclosureModuleSummary, DisclosureValueResponse } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { initialSavedAt, lastSavedAt } from './saved-at';

const summaryAt = (lastAnsweredAt: number | null): DisclosureModuleSummary => ({
  module: 'B1',
  answered: 1,
  total: 2,
  lastAnsweredAt,
  applicable: true,
  omitted: false,
  applicabilityCause: null,
});

const committed = (updatedAt: number): DisclosureValueResponse =>
  ({ elementKey: 'NumberOfEmployees', updatedAt }) as DisclosureValueResponse;

describe('initialSavedAt', () => {
  it('is the newest answer across the modules', () => {
    expect(initialSavedAt([summaryAt(100), summaryAt(null), summaryAt(300), summaryAt(200)])).toBe(300);
  });

  it('is nothing when nothing has been answered, so no moment is invented', () => {
    expect(initialSavedAt([summaryAt(null), summaryAt(null)])).toBeNull();
    expect(initialSavedAt([])).toBeNull();
  });
});

describe('lastSavedAt', () => {
  it('moves to the newest acknowledged commit', () => {
    expect(lastSavedAt({ initial: 100, committed: { a: committed(250), b: committed(180) } })).toBe(250);
  });

  it('keeps the read’s time when nothing newer was acknowledged', () => {
    expect(lastSavedAt({ initial: 400, committed: { a: committed(250) } })).toBe(400);
    expect(lastSavedAt({ initial: 400, committed: {} })).toBe(400);
  });

  it('takes a commit’s time on a report nothing had been answered in', () => {
    expect(lastSavedAt({ initial: null, committed: { a: committed(90) } })).toBe(90);
    expect(lastSavedAt({ initial: null, committed: {} })).toBeNull();
  });
});
