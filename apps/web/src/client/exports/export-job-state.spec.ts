import type { Export } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { nextExportPoll, settleExportJob } from './export-job-state';

const requested = { id: 'e1', status: 'requested' } as unknown as Export;
const completed = { id: 'e1', status: 'completed' } as unknown as Export;

/** S-11's watch (task 47.3): what a poll keeps, and when the next one runs (OQ-36). */
describe('the export watch', () => {
  it('takes what a poll read, and keeps what it knew when a poll could not read', () => {
    expect(settleExportJob({ previous: { export: requested, failures: 2 }, read: completed })).toEqual({ export: completed, failures: 0 });
    expect(settleExportJob({ previous: { export: requested, failures: 2 }, read: null })).toEqual({ export: requested, failures: 3 });
  });

  it('polls every five seconds while requested, backs off after failures, and stops once settled', () => {
    expect(nextExportPoll({ export: requested, failures: 0 })).toBe(5_000);
    // Full jitter: the top of the draw after two failures is the interval doubled twice.
    expect(nextExportPoll({ export: requested, failures: 2 }, () => 0.999_999)).toBe(19_999);
    expect(nextExportPoll({ export: completed, failures: 0 })).toBe(false);
  });
});
