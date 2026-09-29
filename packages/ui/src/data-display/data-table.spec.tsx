import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './data-table';
import { COLUMN_ALIGN, COLUMN_SIZE } from './data-table-vocabulary';

/**
 * Column sizing and alignment (29 Sep 2026). What is asserted is what the table asks the browser
 * for — the header's width and the cells' classes — since jsdom lays nothing out; the result was
 * measured in a browser on S-13.
 */
interface Row {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

const ROWS: Row[] = [{ id: 'a', name: 'Brutăria', count: 2 }];

const table = (columns: DataTableColumn<Row, string>[]) =>
  render(<DataTable caption="Rows" columns={columns} rows={ROWS} rowKey={(row) => row.id} />);

const widths = () => screen.getAllByRole('columnheader').map((header) => header.style.inlineSize);

describe('DataTable sizing', () => {
  it('shares the width equally among fill columns and asks a fit column for its content alone', () => {
    table([
      { key: 'name', header: 'Name', size: COLUMN_SIZE.FILL, cell: (row) => row.name },
      { key: 'other', header: 'Other', size: COLUMN_SIZE.FILL, cell: (row) => row.name },
      { key: 'count', header: 'Count', size: COLUMN_SIZE.FIT, cell: (row) => row.count },
    ]);

    expect(widths()).toEqual(['50%', '50%', '1%']);
  });

  it('asks nothing of a column given no size, so a table that does not opt in is unchanged', () => {
    table([
      { key: 'name', header: 'Name', cell: (row) => row.name },
      { key: 'count', header: 'Count', cell: (row) => row.count },
    ]);

    expect(widths()).toEqual(['', '']);
  });

  it('gives a centred column the same class on its header and its cells', () => {
    table([{ key: 'count', header: 'Count', align: COLUMN_ALIGN.CENTER, cell: (row) => row.count }]);

    const header = screen.getByRole('columnheader').className;
    expect(header).not.toBe('');
    expect(screen.getByRole('cell').className).toBe(header);
  });
});
