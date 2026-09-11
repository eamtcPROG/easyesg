import { describe, expect, it } from 'vitest';
import { REPORT_STATUS, type ReportingPeriod } from '@easyesg/contracts';
import {
  OVERVIEW_STANDING,
  attentionRows,
  everythingRows,
  resumableRow,
  toOverviewRows,
} from './overview';

/**
 * S-05's overview rules (UC-67, FR-23; task 32.4).
 *
 * **Every case here is one a browser journey would have to contrive**: a deadline in the past, a
 * locked period nobody opened a report against, a reader in a zone where yesterday is still today.
 * The journey asserts that the screen renders them; this asserts which rows they are.
 */

const CHISINAU = 'Europe/Chisinau';
/** 12:00 UTC, so no test below is accidentally sitting on a zone boundary. */
const NOW = new Date('2026-09-07T12:00:00.000Z');

const aPeriod = (over: Partial<ReportingPeriod> = {}): ReportingPeriod => ({
  id: 'p1',
  reportingEntityId: 'e1',
  entityName: 'Alfa SRL',
  fiscalYear: 2026,
  periodStart: { date: '2026-01-01', timezone: CHISINAU },
  periodEnd: { date: '2026-12-31', timezone: CHISINAU },
  dueDate: null,
  templateVersion: '2026-05-01',
  taxonomyVersion: '2026-05-01',
  priorPeriodId: null,
  entitySnapshotId: 's1',
  lockedAt: null,
  lockedBy: null,
  createdAt: 0,
  updatedAt: 0,
  report: null,
  ...over,
});

const aReport = (over: Partial<NonNullable<ReportingPeriod['report']>> = {}) => ({
  id: 'r1',
  status: REPORT_STATUS.OPEN,
  updatedAt: 1_000,
  ...over,
});

const rowsFor = (periods: ReportingPeriod[]) => toOverviewRows({ periods, now: NOW });

describe('the standing of a filing', () => {
  it('is *not started* where no report has been opened, which is a state and not an absence', () => {
    const [row] = rowsFor([aPeriod()]);

    expect(row.standing).toBe(OVERVIEW_STANDING.NOT_STARTED);
    expect(row.reportId).toBeNull();
    // FR-23's row: somebody has to start this, and `GET /reports` cannot see it at all.
    expect(row.attention).toBe(true);
  });

  it('is the report’s own status where one exists', () => {
    const [row] = rowsFor([aPeriod({ report: aReport({ status: REPORT_STATUS.LOCKED }) })]);

    expect(row.standing).toBe(OVERVIEW_STANDING.LOCKED);
    expect(row.reportId).toBe('r1');
  });

  /** FR-22: a locked period takes no writes from anyone, so there is nothing to act on. */
  it('does not ask for attention on a locked filing', () => {
    const [row] = rowsFor([aPeriod({ report: aReport({ status: REPORT_STATUS.LOCKED }) })]);

    expect(row.attention).toBe(false);
  });

  /**
   * The case the whole `!periodLocked` conjunct exists for. Without it the screen offers *start a
   * report* on a period `POST /reports` refuses outright — a control that cannot act. The refusal
   * is the lock's, `architecture.md` §12.5.6's task-31.4 row: FR-26 is about granting an *editable
   * session*, which is a different claim and was this comment's first citation.
   */
  it('does not ask for attention on a locked period that never had a report', () => {
    const [row] = rowsFor([aPeriod({ lockedAt: 1_000, report: null })]);

    expect(row.standing).toBe(OVERVIEW_STANDING.NOT_STARTED);
    expect(row.periodLocked).toBe(true);
    expect(row.attention).toBe(false);
  });
});

describe('a deadline that has passed', () => {
  it('marks a due date already gone', () => {
    const [row] = rowsFor([aPeriod({ dueDate: { date: '2026-04-30', timezone: CHISINAU } })]);

    expect(row.overdue).toBe(true);
  });

  it('does not mark one still to come, nor today itself', () => {
    const [future, today] = rowsFor([
      aPeriod({ dueDate: { date: '2027-04-30', timezone: CHISINAU } }),
      // The boundary: a deadline is met on its own day, so *today* is never overdue.
      aPeriod({ id: 'p2', dueDate: { date: '2026-09-07', timezone: CHISINAU } }),
    ]);

    expect(future.overdue).toBe(false);
    expect(today.overdue).toBe(false);
  });

  it('never marks a filing nobody has to act on', () => {
    const [row] = rowsFor([
      aPeriod({
        dueDate: { date: '2026-04-30', timezone: CHISINAU },
        report: aReport({ status: REPORT_STATUS.FILED }),
      }),
    ]);

    // The deadline passed and the report was filed. Saying *overdue* would be a wrong answer, not a
    // stale one.
    expect(row.overdue).toBe(false);
  });

  /**
   * NFR-34 read literally, and the reason `todayIn` takes the period's zone rather than the
   * server's. At 12:00 UTC it is already the 8th in Kiritimati (+14) and still the 7th in Niue
   * (−11) — so a due date of the 7th is overdue in one and not in the other, and the filing's own
   * zone is the one that decides.
   */
  it('answers in the period’s zone, not the reader’s', () => {
    const [ahead, behind] = rowsFor([
      aPeriod({ dueDate: { date: '2026-09-07', timezone: 'Pacific/Kiritimati' } }),
      aPeriod({ id: 'p2', dueDate: { date: '2026-09-07', timezone: 'Pacific/Niue' } }),
    ]);

    expect(ahead.overdue).toBe(true);
    expect(behind.overdue).toBe(false);
  });
});

describe('what needs my attention (UX-6’s first question)', () => {
  it('lists only the filings somebody must act on, soonest deadline first', () => {
    const listed = attentionRows(
      rowsFor([
        aPeriod({ id: 'late', dueDate: { date: '2027-06-30', timezone: CHISINAU } }),
        aPeriod({ id: 'soon', dueDate: { date: '2027-04-30', timezone: CHISINAU } }),
        aPeriod({ id: 'done', report: aReport({ status: REPORT_STATUS.FILED }) }),
      ]),
    );

    expect(listed.map((row) => row.periodId)).toEqual(['soon', 'late']);
  });

  /** FR-21 makes the due date optional, and a row that has none cannot be placed on that scale. */
  it('puts a filing with no due date after every dated one', () => {
    const listed = attentionRows(
      rowsFor([
        aPeriod({ id: 'undated' }),
        aPeriod({ id: 'dated', dueDate: { date: '2099-01-01', timezone: CHISINAU } }),
      ]),
    );

    expect(listed.map((row) => row.periodId)).toEqual(['dated', 'undated']);
  });
});

describe('where did I leave off (UX-6’s second question)', () => {
  it('is the report touched most recently', () => {
    const resumed = resumableRow(
      rowsFor([
        aPeriod({ id: 'older', report: aReport({ id: 'r-old', updatedAt: 1_000 }) }),
        aPeriod({ id: 'newer', report: aReport({ id: 'r-new', updatedAt: 2_000 }) }),
      ]),
    );

    expect(resumed?.reportId).toBe('r-new');
  });

  /** A locked report opens read-only (S-07 draws that state); a filed one is finished. */
  it('offers a locked report and never a filed one', () => {
    const locked = resumableRow(
      rowsFor([aPeriod({ report: aReport({ status: REPORT_STATUS.LOCKED }) })]),
    );
    const filed = resumableRow(
      rowsFor([aPeriod({ report: aReport({ status: REPORT_STATUS.FILED }) })]),
    );

    expect(locked?.reportId).toBe('r1');
    expect(filed).toBeNull();
  });

  it('is nothing at all when no report has been opened', () => {
    expect(resumableRow(rowsFor([aPeriod(), aPeriod({ id: 'p2' })]))).toBeNull();
  });
});

describe('what is the state of everything (UX-6’s third question)', () => {
  it('lists every entity and period, by entity and then newest year first', () => {
    const listed = everythingRows(
      rowsFor([
        aPeriod({ id: 'b-2026', entityName: 'Beta SA', fiscalYear: 2026 }),
        aPeriod({ id: 'a-2025', entityName: 'Alfa SRL', fiscalYear: 2025 }),
        aPeriod({ id: 'a-2026', entityName: 'Alfa SRL', fiscalYear: 2026 }),
      ]),
    );

    expect(listed.map((row) => row.periodId)).toEqual(['a-2026', 'a-2025', 'b-2026']);
  });

  /** FR-23 lists *every* entity and period — a settled filing is part of the answer, not noise. */
  it('keeps the filings that need nothing, which the attention list drops', () => {
    const rows = rowsFor([aPeriod({ report: aReport({ status: REPORT_STATUS.FILED }) })]);

    expect(everythingRows(rows)).toHaveLength(1);
    expect(attentionRows(rows)).toHaveLength(0);
  });
});
