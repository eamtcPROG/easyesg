import { REPORT_MIGRATION_STATUS } from '@api/contracts/report-migration';
import { mayMove, movedStatusOf, pendingOf, retryAdmitted, tallyOf } from './migration-run';
import { COMPATIBILITY } from './version-mapping';

const STANDING = { taxonomyVersion: '2026-02-01', locked: false, archived: false };

describe('a migration run’s arithmetic (tasks 67.23, 67.24)', () => {
  it('puts a compatible pair’s report in force and holds a breaking pair’s for its organization (182/43)', () => {
    expect(movedStatusOf(COMPATIBILITY.COMPATIBLE)).toBe('migrated');
    expect(movedStatusOf(COMPATIBILITY.BREAKING)).toBe('awaiting_review');
  });

  it('moves only a report still on the run’s version, in a period not locked, of an entity not archived', () => {
    expect(mayMove({ report: STANDING, from: '2026-02-01' })).toBe(true);
    expect(mayMove({ report: { ...STANDING, taxonomyVersion: '2026-05-01' }, from: '2026-02-01' })).toBe(false);
    expect(mayMove({ report: { ...STANDING, locked: true }, from: '2026-02-01' })).toBe(false);
    expect(mayMove({ report: { ...STANDING, archived: true }, from: '2026-02-01' })).toBe(false);
  });

  it('counts every status, a status no row holds as zero, and what the worker has not reached', () => {
    const tally = tallyOf([
      { status: REPORT_MIGRATION_STATUS.MIGRATED, reports: 3 },
      { status: REPORT_MIGRATION_STATUS.FAILED, reports: 1 },
    ]);
    expect(tally).toEqual({ migrated: 3, awaiting_review: 0, accepted: 0, declined: 0, reverted: 0, failed: 1, skipped: 0 });
    expect(pendingOf({ selected: 6, tally })).toBe(2);
    expect(pendingOf({ selected: 4, tally })).toBe(0);
  });

  it('admits a retry only where a report failed and the run stands', () => {
    const failed = tallyOf([{ status: REPORT_MIGRATION_STATUS.FAILED, reports: 1 }]);
    expect(retryAdmitted({ tally: failed, reverted: false })).toBe(true);
    expect(retryAdmitted({ tally: failed, reverted: true })).toBe(false);
    expect(retryAdmitted({ tally: tallyOf([]), reverted: false })).toBe(false);
  });
});
