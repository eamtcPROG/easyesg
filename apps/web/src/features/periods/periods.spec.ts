import { describe, expect, it } from 'vitest';
import type { ReportingPeriod } from '@easyesg/contracts';
import {
  DEFAULT_PERIOD_VIEW,
  PERIOD_FILTER_ANY,
  PERIOD_SORT,
  PERIOD_SORT_DIRECTION,
  PERIOD_STANDING,
  applyPeriodView,
  periodViewQuery,
  readPeriodView,
  toPeriodRows,
} from './periods';

/**
 * S-14's read model (task 32.1.2) — the rules a browser journey cannot reach without contriving
 * data, which is what makes them worth a unit spec rather than a Playwright case.
 */
const CHISINAU = 'Europe/Chisinau';

const aPeriod = (over: Partial<ReportingPeriod> = {}): ReportingPeriod =>
  ({
    id: over.id ?? 'p1',
    reportingEntityId: 'e1',
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
    ...over,
  }) as ReportingPeriod;

describe('toPeriodRows', () => {
  /**
   * NFR-34 at the last boundary that could break it. `new Date('2026-12-31')` is an instant, and in
   * a zone behind UTC it renders as the 30th — the wrong fiscal year, which FR-125 makes
   * uncorrectable by editing. The repository selects `::text` for this reason; the row model must
   * not undo it by parsing.
   */
  it('keeps a boundary a calendar day, never an instant', () => {
    const [row] = toPeriodRows([aPeriod()]);

    expect(row.start).toBe('2026-01-01');
    expect(row.end).toBe('2026-12-31');
    // The type is the guarantee: a `Date` here would be the defect, and it would look identical on
    // a machine running in UTC — which is every CI runner.
    expect(typeof row.end).toBe('string');
  });

  it('derives the standing from the lock rather than reading a field', () => {
    const [open, locked] = toPeriodRows([
      aPeriod({ id: 'a' }),
      aPeriod({ id: 'b', lockedAt: 1_780_000_000_000 }),
    ]);

    expect(open.standing).toBe(PERIOD_STANDING.OPEN);
    expect(locked.standing).toBe(PERIOD_STANDING.LOCKED);
  });

  it('reports whether comparatives have a prior period to resolve from (FR-45)', () => {
    const [first, second] = toPeriodRows([
      aPeriod({ id: 'a' }),
      aPeriod({ id: 'b', priorPeriodId: 'a' }),
    ]);

    expect(first.hasPrior).toBe(false);
    expect(second.hasPrior).toBe(true);
  });
});

describe('applyPeriodView', () => {
  const rows = toPeriodRows([
    aPeriod({ id: 'a', fiscalYear: 2024, periodStart: { date: '2024-01-01', timezone: CHISINAU } }),
    aPeriod({
      id: 'b',
      fiscalYear: 2025,
      periodStart: { date: '2025-01-01', timezone: CHISINAU },
      lockedAt: 1_780_000_000_000,
    }),
    aPeriod({ id: 'c', fiscalYear: 2026, periodStart: { date: '2026-01-01', timezone: CHISINAU } }),
  ]);

  it('puts the newest year first by default, which is the filing in hand', () => {
    const page = applyPeriodView({ rows, view: DEFAULT_PERIOD_VIEW });

    expect(page.rows.map((row) => row.fiscalYear)).toEqual([2026, 2025, 2024]);
  });

  /**
   * §4.6's two empty states, and the pair of counts that keeps them apart. `total` is pre-filter, so
   * a zero there is *nothing exists* and teaches; `matched` at zero with a non-zero total is
   * *nothing matches* and offers to clear the filter. Collapsing them is the defect.
   */
  it('reports nothing-matches and nothing-exists as different facts', () => {
    const filteredToNothing = applyPeriodView({
      rows: rows.filter((row) => row.standing === PERIOD_STANDING.OPEN),
      view: { ...DEFAULT_PERIOD_VIEW, standing: PERIOD_STANDING.LOCKED },
    });
    expect(filteredToNothing.matched).toBe(0);
    expect(filteredToNothing.total).toBeGreaterThan(0);

    const nothingExists = applyPeriodView({ rows: [], view: DEFAULT_PERIOD_VIEW });
    expect(nothingExists.matched).toBe(0);
    expect(nothingExists.total).toBe(0);
  });

  /**
   * FR-21 makes the due date optional, and an absent deadline is not an early one. Comparing `''`
   * would sort the periods with no due date to the front — the reading a reporter is most likely to
   * act on and most likely to be wrong about.
   */
  it('sorts a period with no due date last, whichever way the column runs', () => {
    const mixed = toPeriodRows([
      aPeriod({ id: 'a', dueDate: { date: '2027-04-30', timezone: CHISINAU } }),
      aPeriod({ id: 'b', dueDate: null }),
      aPeriod({ id: 'c', dueDate: { date: '2027-01-31', timezone: CHISINAU } }),
    ]);
    const ascending = applyPeriodView({
      rows: mixed,
      view: { ...DEFAULT_PERIOD_VIEW, sort: PERIOD_SORT.DUE, direction: PERIOD_SORT_DIRECTION.ASCENDING },
    });

    expect(ascending.rows.map((row) => row.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('the view lives in the address (UX-4)', () => {
  it('round-trips through the query string', () => {
    const view = {
      standing: PERIOD_STANDING.LOCKED,
      sort: PERIOD_SORT.DUE,
      direction: PERIOD_SORT_DIRECTION.ASCENDING,
      page: 3,
    };

    expect(readPeriodView(Object.fromEntries(new URLSearchParams(periodViewQuery(view))))).toEqual(
      view,
    );
  });

  /** The default view and the bare path are one address, not two spellings of it. */
  it('writes nothing for a default view', () => {
    expect(periodViewQuery(DEFAULT_PERIOD_VIEW)).toBe('');
  });

  it('falls back rather than trusting the address', () => {
    const view = readPeriodView({ standing: 'nonsense', sort: 'nonsense', page: '-4' });

    expect(view.standing).toBe(PERIOD_FILTER_ANY);
    expect(view.sort).toBe(DEFAULT_PERIOD_VIEW.sort);
    expect(view.page).toBe(1);
  });
});
