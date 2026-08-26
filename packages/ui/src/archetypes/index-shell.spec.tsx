import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndexShell, type IndexPage } from './index-shell';

/**
 * The Index archetype's one rule, pinned where it now lives.
 *
 * S-16 wrote this composition first and eleven tenant screens plus four admin queues are behind it.
 * What moved here is not the markup — `DataTable`, `Pagination` and `EmptyState` compose fine by
 * hand — but **which empty state, and on what evidence**, which is the part that is easy to get
 * right once and easy to lose on the fourth screen.
 *
 * `total` is rows before the filter; `matched` is rows after it. A zero in each means a different
 * screen, and collapsing them tells an administrator with nine colleagues that they are alone.
 */
interface Row {
  readonly id: string;
  readonly name: string;
}

const COLUMNS = [
  { key: 'name' as const, header: 'Name', sortable: true as const, cell: (row: Row) => row.name },
];

const LABELS = {
  sort: { sortBy: (column: string) => `Sort by ${column}`, ascending: 'asc', descending: 'desc' },
  pagination: {
    region: 'Pagination',
    previous: 'Previous',
    next: 'Next',
    position: (of: { from: number; to: number; total: number }) =>
      `${of.from}–${of.to} of ${of.total}`,
  },
};

const shell = (page: IndexPage<Row>) => (
  <IndexShell<Row, 'name'>
    page={page}
    caption="People"
    columns={COLUMNS}
    rowKey={(row) => row.id}
    sort={{ column: 'name', direction: 'asc' }}
    onSortChange={vi.fn()}
    onPageChange={vi.fn()}
    empty={{ firstUse: <p>Nobody yet</p>, filtered: <p>Nothing matches</p> }}
    labels={LABELS}
  />
);

const page = (over: Partial<IndexPage<Row>> = {}): IndexPage<Row> => ({
  rows: [{ id: '1', name: 'Ana' }],
  matched: 1,
  total: 1,
  page: 1,
  pageSize: 25,
  ...over,
});

describe('IndexShell (§4.6)', () => {
  it('teaches first use when there is nothing behind the filter either', () => {
    render(shell(page({ rows: [], matched: 0, total: 0 })));

    expect(screen.getByText('Nobody yet')).toBeInTheDocument();
    expect(screen.queryByText('Nothing matches')).not.toBeInTheDocument();
  });

  /** The distinction the archetype exists to hold: rows exist, this filter just found none. */
  it('offers the filter back when rows exist behind it', () => {
    render(shell(page({ rows: [], matched: 0, total: 9 })));

    expect(screen.getByText('Nothing matches')).toBeInTheDocument();
    expect(screen.queryByText('Nobody yet')).not.toBeInTheDocument();
  });

  it('renders the table and no empty state when there are rows', () => {
    render(shell(page()));

    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(screen.queryByText('Nobody yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing matches')).not.toBeInTheDocument();
  });

  /** The pager counts what survived the filter, not what is on screen. */
  it('pages over the matched rows rather than the visible ones', () => {
    render(shell(page({ matched: 60, total: 60 })));

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByText('1–25 of 60')).toBeInTheDocument();
  });

  /** A pager under a five-row list teaches a reader the list is longer than it is. */
  it('renders no pager for a single page', () => {
    render(shell(page()));
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });
});
