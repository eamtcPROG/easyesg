import { describe, expect, it } from 'vitest';
import { REPORT_STATUS, type Report } from '@easyesg/contracts';
import {
  DEFAULT_REPORT_VIEW,
  REPORT_FILTER_ANY,
  REPORT_STATUS_FILTERS,
  REPORT_PAGE_SIZE,
  REPORT_SORT,
  REPORT_SORT_DIRECTION,
  applyReportView,
  readReportView,
  reportFilterOptions,
  reportViewQuery,
  toReportRows,
  type ReportRow,
} from './reports';

/**
 * S-06's read model (task 32.2.2). Pure, so every branch is here rather than in a browser — which
 * is the whole reason `periods.ts` and `entities.ts` keep the filter, the sort and the page
 * arithmetic out of the component.
 */
const row = (over: Partial<ReportRow> = {}): ReportRow => ({
  id: 'r1',
  entityId: 'e1',
  entityName: 'Brutăria Lina SRL',
  fiscalYear: 2026,
  start: '2026-01-01',
  end: '2026-12-31',
  due: null,
  status: REPORT_STATUS.OPEN,
  scope: 'basic',
  templateVersion: '2026-05-01',
  taxonomyVersion: '2026-05-01',
  updatedAt: 1_787_000_000_000,
  ...over,
});

describe('the report view, in the address (UX-4)', () => {
  it('answers the defaults for an empty query', () => {
    expect(readReportView({})).toEqual(DEFAULT_REPORT_VIEW);
  });

  it('round-trips a view through its query string', () => {
    const view = {
      ...DEFAULT_REPORT_VIEW,
      status: REPORT_STATUS.LOCKED,
      entity: 'e9',
      year: '2025',
      sort: REPORT_SORT.ENTITY,
      direction: REPORT_SORT_DIRECTION.ASCENDING,
      page: 3,
    } as const;

    expect(readReportView(Object.fromEntries(new URLSearchParams(reportViewQuery(view))))).toEqual(
      view,
    );
  });

  it('writes nothing for a default view, so the bare path and the default are one address', () => {
    expect(reportViewQuery(DEFAULT_REPORT_VIEW)).toBe('');
  });

  it('ignores a status or sort the vocabulary does not contain', () => {
    const view = readReportView({ status: 'shredded', sort: 'vibes', dir: 'sideways', page: '-2' });
    expect(view).toEqual(DEFAULT_REPORT_VIEW);
  });

  /**
   * **An entity id is NOT validated against anything**, and the distinction matters: a status the
   * vocabulary does not contain is a malformed address, while an entity that no longer has reports
   * is a stale but well-formed one. Coercing the latter to `any` would show the unfiltered list
   * while the filter said otherwise — the silent wrong answer §4.6's filtered empty state exists to
   * replace with a remedy.
   */
  it('keeps an entity filter that matches nothing, rather than silently clearing it', () => {
    expect(readReportView({ entity: 'gone' }).entity).toBe('gone');
    expect(applyReportView({ rows: [row()], view: readReportView({ entity: 'gone' }) })).toMatchObject(
      { matched: 0, total: 1 },
    );
  });

  it('takes the first value when a parameter arrives repeated', () => {
    expect(readReportView({ year: ['2025', '2026'] }).year).toBe('2025');
  });
});

describe('filtering and sorting', () => {
  const rows = [
    row({ id: 'a', entityName: 'Aurora SRL', fiscalYear: 2025, updatedAt: 300 }),
    row({ id: 'b', entityName: 'Brutăria Lina SRL', fiscalYear: 2026, updatedAt: 100 }),
    row({ id: 'c', entityId: 'e2', entityName: 'Cofetăria Doina SRL', fiscalYear: 2026, updatedAt: 200, status: REPORT_STATUS.LOCKED }),
  ];

  it('defaults to newest activity first — the artboard’s own order', () => {
    const page = applyReportView({ rows, view: DEFAULT_REPORT_VIEW });
    expect(page.rows.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts by entity name, and reverses', () => {
    const ascending = applyReportView({
      rows,
      view: { ...DEFAULT_REPORT_VIEW, sort: REPORT_SORT.ENTITY, direction: REPORT_SORT_DIRECTION.ASCENDING },
    });
    expect(ascending.rows.map((r) => r.entityName)).toEqual([
      'Aurora SRL',
      'Brutăria Lina SRL',
      'Cofetăria Doina SRL',
    ]);

    const descending = applyReportView({
      rows,
      view: { ...DEFAULT_REPORT_VIEW, sort: REPORT_SORT.ENTITY, direction: REPORT_SORT_DIRECTION.DESCENDING },
    });
    expect(descending.rows.map((r) => r.entityName)).toEqual([
      'Cofetăria Doina SRL',
      'Brutăria Lina SRL',
      'Aurora SRL',
    ]);
  });

  it('ranks work in hand above settled rows when sorting by status', () => {
    const page = applyReportView({
      rows: [row({ id: 'l', status: REPORT_STATUS.LOCKED }), row({ id: 'o', status: REPORT_STATUS.OPEN })],
      view: { ...DEFAULT_REPORT_VIEW, sort: REPORT_SORT.STATUS, direction: REPORT_SORT_DIRECTION.ASCENDING },
    });
    expect(page.rows.map((r) => r.id)).toEqual(['o', 'l']);
  });

  /**
   * **The status filter had no failing state at all**, which the gate review proved by deleting the
   * predicate and watching every test stay green: the "all three filters" case below narrows to one
   * row on entity and year alone, so the third predicate never did any work. Inverting it was
   * caught; *deleting* it was not, and deletion is the regression that actually arrives.
   */
  it('narrows by status alone', () => {
    const page = applyReportView({
      rows,
      view: { ...DEFAULT_REPORT_VIEW, status: REPORT_STATUS.LOCKED },
    });
    expect(page.rows.map((r) => r.id)).toEqual(['c']);
  });

  /** The year comparator's own arm — three separate mutations of it survived the first suite. */
  it('sorts by fiscal year', () => {
    const page = applyReportView({
      rows,
      view: {
        ...DEFAULT_REPORT_VIEW,
        sort: REPORT_SORT.YEAR,
        direction: REPORT_SORT_DIRECTION.ASCENDING,
      },
    });
    expect(page.rows.map((r) => r.fiscalYear)).toEqual([2025, 2026, 2026]);
  });

  it('narrows by all three filters at once', () => {
    const page = applyReportView({
      rows,
      view: { ...DEFAULT_REPORT_VIEW, entity: 'e1', year: '2026', status: REPORT_STATUS.OPEN },
    });
    expect(page.rows.map((r) => r.id)).toEqual(['b']);
  });

  /**
   * **`matched` and `total` are the two empty states**, and this is the assertion that keeps them
   * distinguishable: a filtered-to-nothing list still reports a non-zero total, which is what tells
   * §4.6's shell to offer *clear the filter* rather than to teach what a report is.
   */
  it('reports matched and total separately, which is what tells the two empty states apart', () => {
    const filtered = applyReportView({ rows, view: { ...DEFAULT_REPORT_VIEW, year: '1999' } });
    expect(filtered).toMatchObject({ matched: 0, total: 3 });

    const nothing = applyReportView({ rows: [], view: DEFAULT_REPORT_VIEW });
    expect(nothing).toMatchObject({ matched: 0, total: 0 });
  });

  it('clamps a page past the end rather than showing an empty one', () => {
    const page = applyReportView({ rows, view: { ...DEFAULT_REPORT_VIEW, page: 9 } });
    expect(page.page).toBe(1);
    expect(page.rows).toHaveLength(3);
  });

  it('pages at the declared size', () => {
    const many = Array.from({ length: REPORT_PAGE_SIZE + 4 }, (_, index) =>
      row({ id: `r${index}`, updatedAt: index }),
    );
    const first = applyReportView({ rows: many, view: DEFAULT_REPORT_VIEW });
    expect(first.rows).toHaveLength(REPORT_PAGE_SIZE);
    expect(applyReportView({ rows: many, view: { ...DEFAULT_REPORT_VIEW, page: 2 } }).rows).toHaveLength(4);
  });

  /** Two rows that compare equal must not swap between renders — the tiebreak is the id. */
  it('orders equal rows stably', () => {
    const tied = [row({ id: 'z', updatedAt: 1 }), row({ id: 'a', updatedAt: 1 })];
    const once = applyReportView({ rows: tied, view: DEFAULT_REPORT_VIEW });
    const twice = applyReportView({ rows: [...tied].reverse(), view: DEFAULT_REPORT_VIEW });
    expect(once.rows.map((r) => r.id)).toEqual(twice.rows.map((r) => r.id));
  });
});

/**
 * **The filter list is hand-written where the tone and rank maps are exhaustive `Record`s**, and the
 * module's docblock claimed the contract held all three. It does not: dropping two members from the
 * array compiles and leaves them permanently unofferable, which the gate review proved. This is the
 * hold the array could not give itself.
 */
describe('the status filter offers the whole vocabulary', () => {
  it('lists every contract status, after the "any" member', () => {
    expect([...REPORT_STATUS_FILTERS].slice(1)).toEqual(Object.values(REPORT_STATUS));
  });

  it('leads with the no-filter member, which the address has to be able to say', () => {
    expect(REPORT_STATUS_FILTERS[0]).toBe(REPORT_FILTER_ANY);
  });
});

describe('the filter’s own options', () => {
  it('offers only entities and years the rows actually contain', () => {
    const options = reportFilterOptions([
      row({ id: 'a', entityId: 'e2', entityName: 'Zorile SRL', fiscalYear: 2024 }),
      row({ id: 'b', entityId: 'e1', entityName: 'Aurora SRL', fiscalYear: 2026 }),
      row({ id: 'c', entityId: 'e1', entityName: 'Aurora SRL', fiscalYear: 2026 }),
    ]);

    // Distinct, named, and alphabetical — a filter is a list to read, not the row order repeated.
    expect(options.entities).toEqual([
      { id: 'e1', name: 'Aurora SRL' },
      { id: 'e2', name: 'Zorile SRL' },
    ]);
    // Newest first, matching how the years are met on the list itself.
    expect(options.years).toEqual([2026, 2024]);
  });

  it('offers nothing for no rows, so the filtered state cannot be reached from an empty list', () => {
    expect(reportFilterOptions([])).toEqual({ entities: [], years: [] });
  });
});

describe('the row from the wire', () => {
  const wire = (over: Partial<Report> = {}): Report => ({
    id: 'r1',
    reportingPeriodId: 'p1',
    scope: 'basic',
    status: REPORT_STATUS.OPEN,
    templateVersion: '2026-05-01',
    taxonomyVersion: '2026-05-01',
    createdAt: 1,
    updatedAt: 2,
    subject: {
      reportingEntityId: 'e1',
      entityName: 'Brutăria Lina SRL',
      fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
      periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
      dueDate: null,
    },
    ...over,
  });

  /**
   * **The dates stay strings.** `new Date('2026-12-31')` is an instant, and read in a zone behind
   * UTC it is the 30th — the wrong fiscal year, which FR-125 makes uncorrectable by editing. This
   * asserts the type as well as the value, because a `Date` here would still render plausibly.
   */
  it('keeps legal dates as the ISO days they are, never as instants', () => {
    const [built] = toReportRows([wire()]);
    expect(built.start).toBe('2026-01-01');
    expect(built.end).toBe('2026-12-31');
    expect(typeof built.start).toBe('string');
  });

  it('carries the subject the join answers, so no row has to fetch its own name', () => {
    const [built] = toReportRows([wire()]);
    expect(built).toMatchObject({
      entityId: 'e1',
      entityName: 'Brutăria Lina SRL',
      fiscalYear: 2026,
      taxonomyVersion: '2026-05-01',
    });
  });

  it('reads an absent due date as none rather than as a missing field', () => {
    expect(toReportRows([wire()])[0].due).toBeNull();
  });
});
