import { describe, expect, it } from 'vitest';
import { cellIn, IMPORT_FIELD, proposeColumns, requiredFields, tableOf } from './import-columns';
import { wordsOf } from './import-text';

describe('tableOf', () => {
  it('takes the first row holding anything as the names, and numbers the rows below as the file does', () => {
    const table = tableOf([
      [null, null],
      ['Sursa', 'Cifra'],
      ['Gaz', '500'],
      [null, null],
      ['Motorină', '332'],
      [null],
    ]);

    expect(table).toEqual({
      headers: ['Sursa', 'Cifra'],
      rows: [
        { number: 3, cells: ['Gaz', '500'] },
        { number: 5, cells: ['Motorină', '332'] },
      ],
    });
  });

  it('names a column the naming row leaves blank as blank, as wide as the widest row', () => {
    expect(tableOf([['Sursa'], ['Gaz', '500', 'Cuptor']])?.headers).toEqual(['Sursa', '', '']);
  });

  it('is nothing for a sheet holding nothing', () => {
    expect(tableOf([])).toBeNull();
    expect(tableOf([[null], [null, null]])).toBeNull();
  });
});

describe('cellIn', () => {
  const row = { number: 2, cells: ['Gaz', null] };

  it('reads the column a field was given, and nothing where it was given none or the row is short', () => {
    expect(cellIn({ row, column: 0 })).toBe('Gaz');
    expect(cellIn({ row, column: 1 })).toBeNull();
    expect(cellIn({ row, column: 7 })).toBeNull();
    expect(cellIn({ row, column: null })).toBeNull();
  });
});

describe('proposeColumns', () => {
  const words = {
    [IMPORT_FIELD.SOURCE]: wordsOf('sursa, sursă de energie, tip, source'),
    [IMPORT_FIELD.FIGURE]: wordsOf('cifra, cantitate, consum, quantity'),
    [IMPORT_FIELD.UNIT]: wordsOf('unitate, unitatea, u m, um, unit'),
    [IMPORT_FIELD.SITE]: wordsOf('locație, locația, sediu, site'),
    [IMPORT_FIELD.DESCRIPTION]: wordsOf('descriere, nota, description'),
  };

  it('proposes each field the column whose name holds one of its words, accents and case aside', () => {
    expect(
      proposeColumns({
        headers: ['Descriere', 'Cantitate (consum)', 'U.M.', 'Sursă de energie', 'Locația'],
        words,
        sites: 2,
      }),
    ).toEqual({ source: 3, figure: 1, unit: 2, site: 4, description: 0 });
  });

  it('gives a column to one field only, the first asked', () => {
    // `Tip consum` holds a source word and a figure word: the source is asked first and takes it.
    expect(proposeColumns({ headers: ['Tip consum', 'Cifra'], words, sites: 1 })).toMatchObject({
      source: 0,
      figure: 1,
    });
  });

  it('proposes no site column for a report holding one site, and nothing for a name it does not know', () => {
    expect(proposeColumns({ headers: ['Sursa', 'Cifra', 'Locație', 'Factura nr.'], words, sites: 1 })).toEqual({
      source: 0,
      figure: 1,
      unit: null,
      site: null,
      description: null,
    });
  });

  it('matches whole words, so a name that merely starts like one is not proposed', () => {
    expect(proposeColumns({ headers: ['Unitatea', 'Units sold'], words, sites: 1 }).unit).toBe(0);
    expect(proposeColumns({ headers: ['Unitary price'], words, sites: 1 }).unit).toBeNull();
  });
});

describe('requiredFields', () => {
  it('asks for the site only where the report holds more than one', () => {
    expect(requiredFields(1)).toEqual(['source', 'figure']);
    expect(requiredFields(2)).toEqual(['source', 'figure', 'site']);
  });
});
