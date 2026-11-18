import { describe, expect, it } from 'vitest';
import type { MigrationTallyEntry } from '@easyesg/contracts';
import { reportsIn, retryOffered, revertOffered, runIsMoving, shownStatuses } from './run-progress';

const tally = (counts: Record<string, number>): MigrationTallyEntry[] =>
  ['migrated', 'awaiting_review', 'accepted', 'declined', 'reverted', 'failed', 'skipped'].map((status) => ({
    status: status as MigrationTallyEntry['status'],
    reports: counts[status] ?? 0,
  }));

describe('a run’s progress on A-04 (task 67.7)', () => {
  it('polls while reports are pending and the run stands, and stops once settled or reverted', () => {
    expect(runIsMoving({ pending: 3, revertedAt: null })).toBe(true);
    expect(runIsMoving({ pending: 0, revertedAt: null })).toBe(false);
    expect(runIsMoving({ pending: 3, revertedAt: 1_800_000_000_000 })).toBe(false);
  });

  it('offers a retry only where a report failed and the run stands, and a revert once', () => {
    expect(retryOffered({ tally: tally({ failed: 1 }), revertedAt: null })).toBe(true);
    expect(retryOffered({ tally: tally({ migrated: 4 }), revertedAt: null })).toBe(false);
    expect(retryOffered({ tally: tally({ failed: 1 }), revertedAt: 1 })).toBe(false);
    expect(revertOffered({ revertedAt: null })).toBe(true);
    expect(revertOffered({ revertedAt: 1 })).toBe(false);
  });

  it('reads a status’s count, and shows only the statuses some report holds, in order', () => {
    const counts = tally({ skipped: 2, migrated: 5 });
    expect(reportsIn(counts, 'migrated')).toBe(5);
    expect(reportsIn([], 'migrated')).toBe(0);
    expect(shownStatuses(counts)).toEqual(['migrated', 'skipped']);
  });
});
