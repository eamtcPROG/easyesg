import { describe, expect, it } from 'vitest';
import type { ReportingPeriod } from '@easyesg/contracts';
import { newestPeriods, periodsByEntity, toEntityPeriods } from './entity-periods';

/**
 * S-13's periods column and side panel — the grouping and the cut a browser journey would need several entities and
 * several years of seeded periods to reach.
 */
const CHISINAU = 'Europe/Chisinau';

const aPeriod = (over: Partial<ReportingPeriod> & { readonly id: string }): ReportingPeriod => ({
  reportingEntityId: 'e1',
  entityName: 'Alfa SRL',
  report: null,
  fiscalYear: 2026,
  periodStart: { date: '2026-01-01', timezone: CHISINAU },
  periodEnd: { date: '2026-12-31', timezone: CHISINAU },
  dueDate: null,
  templateVersion: '2026-05-01',
  taxonomyVersion: '2026-05-01',
  priorPeriodId: null,
  entitySnapshotId: null,
  lockedAt: null,
  lockedBy: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('toEntityPeriods', () => {
  it('puts the newest year first whatever order the answer came in, with the standing read off the lock', () => {
    const periods = toEntityPeriods([
      aPeriod({ id: 'p2024', fiscalYear: 2024, lockedAt: 1 }),
      aPeriod({ id: 'p2026', fiscalYear: 2026 }),
      aPeriod({ id: 'p2025', fiscalYear: 2025, lockedAt: 2 }),
    ]);

    expect(periods).toEqual([
      { id: 'p2026', fiscalYear: 2026, standing: 'open' },
      { id: 'p2025', fiscalYear: 2025, standing: 'locked' },
      { id: 'p2024', fiscalYear: 2024, standing: 'locked' },
    ]);
  });
});

describe('periodsByEntity', () => {
  it('groups the organization’s periods under each entity, and names no entity that has none', () => {
    const grouped = periodsByEntity([
      aPeriod({ id: 'a2025', reportingEntityId: 'alfa', fiscalYear: 2025 }),
      aPeriod({ id: 'b2026', reportingEntityId: 'beta', fiscalYear: 2026 }),
      aPeriod({ id: 'a2026', reportingEntityId: 'alfa', fiscalYear: 2026 }),
    ]);

    expect(grouped.get('alfa')?.map((period) => period.id)).toEqual(['a2026', 'a2025']);
    expect(grouped.get('beta')?.map((period) => period.id)).toEqual(['b2026']);
    // Absent rather than an empty list — the caller reads absence as none, so there is one spelling of it.
    expect(grouped.has('gamma')).toBe(false);
  });
});

describe('newestPeriods', () => {
  const four = toEntityPeriods(
    [2023, 2024, 2025, 2026].map((year) => aPeriod({ id: `p${year}`, fiscalYear: year })),
  );

  it('names the newest and counts the rest', () => {
    const { named, more } = newestPeriods({ periods: four, named: 2 });

    expect(named.map((period) => period.fiscalYear)).toEqual([2026, 2025]);
    expect(more).toBe(2);
  });

  it('counts nothing when every period fits — never a negative remainder', () => {
    expect(newestPeriods({ periods: four.slice(0, 1), named: 3 })).toEqual({ named: four.slice(0, 1), more: 0 });
    expect(newestPeriods({ periods: [], named: 2 })).toEqual({ named: [], more: 0 });
  });
});
