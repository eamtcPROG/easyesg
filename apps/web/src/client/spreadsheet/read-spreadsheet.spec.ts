import { describe, expect, it, vi } from 'vitest';
import { formatOf, readSpreadsheet, SPREADSHEET_OUTCOME, SPREADSHEET_REFUSAL } from './read-spreadsheet';

/**
 * The reader's claims that hold without a browser: a `.csv` read through the real `papaparse`, each refusal, and the
 * format told by the name. An `.xlsx` read through the real `read-excel-file` is proven in a real browser instead
 * (`e2e/web/calculator-import.spec.ts`), with a workbook built by the journey — its cells' conversion is
 * `sheet-cells.spec.ts`'.
 */
const MEGABYTE = 1_048_576;
const csv = (text: string, name = 'facturi.csv') => new File([text], name, { type: 'text/csv' });

describe('readSpreadsheet', () => {
  it('reads a semicolon .csv where a comma is the decimal point, as one unnamed sheet', async () => {
    const read = await readSpreadsheet({ file: csv('Sursa;Cifra\nGaz natural;1700,5\n'), maxBytes: MEGABYTE });

    expect(read).toEqual({
      kind: SPREADSHEET_OUTCOME.READ,
      sheets: [
        {
          name: null,
          rows: [
            ['Sursa', 'Cifra'],
            ['Gaz natural', '1700,5'],
            // The file's last line break, kept as the empty row it is — the import skips empty rows.
            [null],
          ],
        },
      ],
    });
  });

  it('tells the semicolon from a decimal comma in every row, a quoted comma included', async () => {
    const read = await readSpreadsheet({
      file: csv('Sursa;Cifra;Descriere\nGaz;1700,5;"Cuptor, boiler"\nMotorină;332,25;Duba\n\n'),
      maxBytes: MEGABYTE,
    });

    expect(read).toMatchObject({
      sheets: [
        {
          rows: [
            ['Sursa', 'Cifra', 'Descriere'],
            ['Gaz', '1700,5', 'Cuptor, boiler'],
            ['Motorină', '332,25', 'Duba'],
            [null],
            [null],
          ],
        },
      ],
    });
  });

  it('reads a comma .csv, a quoted field keeping its comma, and drops a byte-order mark', async () => {
    // `papaparse` drops the mark; this holds it to that if the reader is ever replaced. The first field is quoted on
    // purpose: a mark left in front of its quote makes it an unquoted field whose quotes survive into the column's
    // name, where unquoted, trimming alone would hide a mark left in place.
    const read = await readSpreadsheet({
      file: csv(`${String.fromCharCode(0xfeff)}"Source",Figure,Description\nNatural gas,500,"Oven, boiler"`),
      maxBytes: MEGABYTE,
    });

    expect(read).toMatchObject({
      kind: SPREADSHEET_OUTCOME.READ,
      sheets: [{ rows: [['Source', 'Figure', 'Description'], ['Natural gas', '500', 'Oven, boiler']] }],
    });
  });

  it('refuses a .csv with a quote left open, whose rows cannot be trusted', async () => {
    const read = await readSpreadsheet({ file: csv('Sursa;Cifra\n"Gaz;500\n'), maxBytes: MEGABYTE });

    expect(read).toEqual({ kind: SPREADSHEET_OUTCOME.REFUSED, refusal: SPREADSHEET_REFUSAL.UNREADABLE });
  });

  it('refuses a file named neither .xlsx nor .csv, before reading it', async () => {
    const read = await readSpreadsheet({ file: csv('Sursa;Cifra', 'facturi.xls'), maxBytes: MEGABYTE });

    expect(read).toEqual({ kind: SPREADSHEET_OUTCOME.REFUSED, refusal: SPREADSHEET_REFUSAL.FORMAT });
  });

  it('refuses a file larger than allowed, and takes one exactly at the limit', async () => {
    const atLimit = csv('x'.repeat(16));

    expect(await readSpreadsheet({ file: atLimit, maxBytes: 15 })).toEqual({
      kind: SPREADSHEET_OUTCOME.REFUSED,
      refusal: SPREADSHEET_REFUSAL.SIZE,
    });
    expect(await readSpreadsheet({ file: atLimit, maxBytes: 16 })).toMatchObject({ kind: SPREADSHEET_OUTCOME.READ });
  });

  it('refuses with its own reason when the reader cannot be loaded — not as a file that is no spreadsheet', async () => {
    // A chunk that will not load is what a lost connection looks like to a lazy `import()`.
    vi.resetModules();
    vi.doMock('papaparse', () => {
      throw new Error('Loading chunk failed');
    });
    try {
      const fresh = await import('./read-spreadsheet');

      expect(await fresh.readSpreadsheet({ file: csv('Sursa;Cifra'), maxBytes: MEGABYTE })).toEqual({
        kind: SPREADSHEET_OUTCOME.REFUSED,
        refusal: SPREADSHEET_REFUSAL.READER,
      });
    } finally {
      vi.doUnmock('papaparse');
      vi.resetModules();
    }
  });

  it('refuses a file named .xlsx that is not a workbook', async () => {
    const file = new File(['Sursa;Cifra'], 'facturi.xlsx');

    expect(await readSpreadsheet({ file, maxBytes: MEGABYTE })).toEqual({
      kind: SPREADSHEET_OUTCOME.REFUSED,
      refusal: SPREADSHEET_REFUSAL.UNREADABLE,
    });
  });
});

describe('formatOf', () => {
  it('tells the format by the name, in any case, and nothing else', () => {
    expect(formatOf('Facturi 2025.XLSX')).toBe('xlsx');
    expect(formatOf('facturi.csv')).toBe('csv');
    expect(formatOf('facturi.xls')).toBeNull();
    expect(formatOf('csv')).toBeNull();
  });
});
