import { describe, expect, it } from 'vitest';
import { SPREADSHEET_REFUSAL } from '@/client/spreadsheet/read-spreadsheet';
import type { ColumnChoice } from './import-columns';
import {
  chosenColumns,
  chosenOption,
  IMPORT_EVENT,
  IMPORT_STAGE,
  importReducer,
  INITIAL_IMPORT_STATE,
  type ImportState,
} from './import-state';

const SHEETS = [
  { name: 'Facturi', rows: [['Sursa', 'Cifra']] },
  { name: 'Note', rows: [['Text']] },
];

const reading: ImportState = { stage: IMPORT_STAGE.READING, fileName: 'facturi.xlsx' };
const mapping = importReducer(reading, { type: IMPORT_EVENT.FILE_READ, sheets: SHEETS });

describe('importReducer', () => {
  it('reads a chosen file into the first sheet, with nothing chosen yet', () => {
    const chosen = importReducer(INITIAL_IMPORT_STATE, { type: IMPORT_EVENT.FILE_CHOSEN, fileName: 'facturi.xlsx' });

    expect(chosen).toEqual(reading);
    expect(mapping).toEqual({
      stage: IMPORT_STAGE.MAPPING,
      fileName: 'facturi.xlsx',
      sheets: SHEETS,
      sheet: 0,
      columns: {},
      values: {},
    });
  });

  it('returns to choosing with the reason when the file is refused, and forgets it when another is chosen', () => {
    const refused = importReducer(reading, { type: IMPORT_EVENT.FILE_REFUSED, refusal: SPREADSHEET_REFUSAL.SIZE });

    expect(refused).toEqual({ stage: IMPORT_STAGE.CHOOSING, refusal: SPREADSHEET_REFUSAL.SIZE });
    expect(importReducer(refused, { type: IMPORT_EVENT.FILE_CHOSEN, fileName: 'mai-mic.csv' })).toEqual({
      stage: IMPORT_STAGE.READING,
      fileName: 'mai-mic.csv',
    });
  });

  it('drops a read that arrives once the reporter has moved on', () => {
    expect(importReducer(INITIAL_IMPORT_STATE, { type: IMPORT_EVENT.FILE_READ, sheets: SHEETS })).toBe(
      INITIAL_IMPORT_STATE,
    );
    expect(importReducer(mapping, { type: IMPORT_EVENT.FILE_REFUSED, refusal: SPREADSHEET_REFUSAL.FORMAT })).toBe(
      mapping,
    );
  });

  it('forgets the values matched from a column when the column changes, and keeps the others', () => {
    const matched = [
      { type: IMPORT_EVENT.VALUE_MATCHED, field: 'source', value: 'Gaz', option: 'natural_gas' },
      { type: IMPORT_EVENT.VALUE_MATCHED, field: 'unit', value: 'mc', option: 'm3' },
      { type: IMPORT_EVENT.COLUMN_CHOSEN, field: 'source', column: 3 },
    ] as const;
    const state = matched.reduce(importReducer, mapping);

    expect(state).toMatchObject({ columns: { source: 3 }, values: { source: {}, unit: { mc: 'm3' } } });
  });

  it('keeps the values matched when a column no value comes from changes', () => {
    const state = [
      { type: IMPORT_EVENT.VALUE_MATCHED, field: 'source', value: 'Gaz', option: 'natural_gas' },
      { type: IMPORT_EVENT.COLUMN_CHOSEN, field: 'figure', column: 1 },
    ] as const;

    expect(state.reduce(importReducer, mapping)).toMatchObject({ values: { source: { Gaz: 'natural_gas' } } });
  });

  it('forgets every choice when another sheet is chosen, and nothing when the same one is', () => {
    const chosen = importReducer(mapping, { type: IMPORT_EVENT.COLUMN_CHOSEN, field: 'source', column: 0 });

    expect(importReducer(chosen, { type: IMPORT_EVENT.SHEET_CHOSEN, sheet: 0 })).toBe(chosen);
    expect(importReducer(chosen, { type: IMPORT_EVENT.SHEET_CHOSEN, sheet: 1 })).toMatchObject({
      sheet: 1,
      columns: {},
      values: {},
    });
  });

  it('starts again from choosing a file, whatever stage it was in', () => {
    expect(importReducer(mapping, { type: IMPORT_EVENT.ANOTHER_FILE })).toEqual(INITIAL_IMPORT_STATE);
  });
});

describe('chosenColumns', () => {
  const proposed: ColumnChoice = { source: 0, figure: 1, unit: 2, site: null, description: null };

  it('lays the reporter’s choices over the proposal — a choice of no column included', () => {
    expect(chosenColumns({ proposed, chosen: { figure: 4, unit: null, site: 3 } })).toEqual({
      source: 0,
      figure: 4,
      unit: null,
      site: 3,
      description: null,
    });
  });
});

describe('chosenOption', () => {
  const values = { source: { Gaz: 'natural_gas', Abur: null } };

  it('takes the reporter’s match — a match to none included — and the proposal where they made none', () => {
    expect(chosenOption({ values, field: 'source', value: 'Gaz', proposed: null })).toBe('natural_gas');
    expect(chosenOption({ values, field: 'source', value: 'Abur', proposed: 'natural_gas' })).toBeNull();
    expect(chosenOption({ values, field: 'source', value: 'Curent', proposed: 'electricity_grid' })).toBe(
      'electricity_grid',
    );
    expect(chosenOption({ values, field: 'unit', value: 'mc', proposed: 'm3' })).toBe('m3');
  });
});
