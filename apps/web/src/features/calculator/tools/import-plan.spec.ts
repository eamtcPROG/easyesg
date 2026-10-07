import { GHG_SCOPE, type CalcFactorSource } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import type { ColumnChoice, ImportTable } from './import-columns';
import { IMPORT_LIMITS, IMPORT_PLAN, IMPORT_PROBLEM, planImport, SHEET_REFUSAL } from './import-plan';
import type { MatchedField } from './import-values';

// The factors themselves play no part in a plan; only which units a source admits does.
const source = (key: string, units: string[]): CalcFactorSource => ({
  key,
  units,
  ghgScope: GHG_SCOPE.SCOPE_1,
  megawattHoursPerUnit: Object.fromEntries(units.map((unit) => [unit, '1'])),
  emissionFactor: '1',
  reference: 'test',
});
const SOURCES = [source('natural_gas', ['m3']), source('electricity_grid', ['kWh', 'MWh'])];
const TWO_SITES = [
  { ordinal: 0, name: 'Brutăria' },
  { ordinal: 1, name: 'Magazinul' },
];
const ONE_SITE = [{ ordinal: 0, name: 'Brutăria' }];

// Sursa · Locația · Cifra · U.M. · Descriere
const COLUMNS: ColumnChoice = { source: 0, site: 1, figure: 2, unit: 3, description: 4 };

/** What the reporter matched: the sheet's words to the calculator's. */
const MATCHES: Readonly<Record<MatchedField, Readonly<Record<string, string>>>> = {
  source: { Gaz: 'natural_gas', Curent: 'electricity_grid' },
  unit: { mc: 'm3', kWh: 'kWh', MWh: 'MWh' },
  site: { Brutăria: '0', Magazinul: '1' },
};
const matched = ({ field, value }: { field: MatchedField; value: string }) => MATCHES[field][value] ?? null;

const tableWith = (...rows: (string | null)[][]): ImportTable => ({
  headers: ['Sursa', 'Locația', 'Cifra', 'U.M.', 'Descriere'],
  rows: rows.map((cells, index) => ({ number: index + 2, cells })),
});

const plan = (table: ImportTable | null, overrides: Partial<Parameters<typeof planImport>[0]> = {}) =>
  planImport({ table, columns: COLUMNS, matched, sources: SOURCES, sites: TWO_SITES, ...overrides });

describe('planImport', () => {
  it('makes one line of one figure for the period from each readable row, in the sheet’s unit, at its site', () => {
    expect(
      plan(tableWith(['Gaz', 'Brutăria', '1 700,5', 'mc', 'Cuptor'], ['Curent', 'Magazinul', '17000', 'kWh', null])),
    ).toEqual({
      kind: IMPORT_PLAN.READY,
      lines: [
        { siteOrdinal: 0, sourceKey: 'natural_gas', description: 'Cuptor', quantity: '1700.5', unitCode: 'm3' },
        { siteOrdinal: 1, sourceKey: 'electricity_grid', description: null, quantity: '17000', unitCode: 'kWh' },
      ],
      unreadable: [],
    });
  });

  it('takes the one unit a source admits where the row names none, and the one site where the report holds one', () => {
    const result = plan(tableWith(['Gaz', null, '500', null, null]), {
      columns: { ...COLUMNS, site: null, unit: null },
      sites: ONE_SITE,
    });

    expect(result).toMatchObject({ lines: [{ siteOrdinal: 0, quantity: '500', unitCode: 'm3' }], unreadable: [] });
  });

  it('reports each row it cannot read, by its number, with the first problem met and the cell it is about', () => {
    const result = plan(
      tableWith(
        [null, 'Brutăria', '1', 'mc', null],
        ['Abur', 'Brutăria', '1', 'mc', null],
        ['Gaz', null, '1', 'mc', null],
        ['Gaz', 'Depozitul', '1', 'mc', null],
        ['Gaz', 'Brutăria', null, 'mc', null],
        ['Gaz', 'Brutăria', 'circa 500', 'mc', null],
        ['Gaz', 'Brutăria', '-5', 'mc', null],
        ['Curent', 'Brutăria', '1', null, null],
        ['Curent', 'Brutăria', '1', 'kilowați', null],
        ['Gaz', 'Brutăria', '1', 'kWh', null],
        ['Gaz', 'Brutăria', '1', 'mc', 'x'.repeat(IMPORT_LIMITS.LINE_TEXT + 1)],
        // Several problems: the source is reported, the first a reader fixes.
        ['Abur', null, null, 'kilowați', null],
      ),
    );

    expect(result).toEqual({
      kind: IMPORT_PLAN.READY,
      lines: [],
      unreadable: [
        { number: 2, problem: IMPORT_PROBLEM.SOURCE_MISSING, value: null },
        { number: 3, problem: IMPORT_PROBLEM.SOURCE_UNMATCHED, value: 'Abur' },
        { number: 4, problem: IMPORT_PROBLEM.SITE_MISSING, value: null },
        { number: 5, problem: IMPORT_PROBLEM.SITE_UNMATCHED, value: 'Depozitul' },
        { number: 6, problem: IMPORT_PROBLEM.NO_FIGURE, value: null },
        { number: 7, problem: IMPORT_PROBLEM.NOT_A_FIGURE, value: 'circa 500' },
        { number: 8, problem: IMPORT_PROBLEM.NOT_A_FIGURE, value: '-5' },
        { number: 9, problem: IMPORT_PROBLEM.UNIT_MISSING, value: null },
        { number: 10, problem: IMPORT_PROBLEM.UNIT_UNMATCHED, value: 'kilowați' },
        { number: 11, problem: IMPORT_PROBLEM.UNIT_NOT_ADMITTED, value: 'kWh' },
        { number: 12, problem: IMPORT_PROBLEM.DESCRIPTION_TOO_LONG, value: null },
        { number: 13, problem: IMPORT_PROBLEM.SOURCE_UNMATCHED, value: 'Abur' },
      ],
    });
  });

  it('refuses a figure longer than a line’s request admits', () => {
    const long = '9'.repeat(IMPORT_LIMITS.FIGURE_TEXT + 1);

    expect(plan(tableWith(['Gaz', 'Brutăria', long, 'mc', null]))).toMatchObject({
      unreadable: [{ problem: IMPORT_PROBLEM.NOT_A_FIGURE }],
    });
  });

  it('asks for the columns a line cannot be made without, the site only of a report holding more than one', () => {
    const none: ColumnChoice = { source: null, site: null, figure: null, unit: null, description: null };
    const table = tableWith(['Gaz', 'Brutăria', '1', 'mc', null]);

    expect(plan(table, { columns: none })).toEqual({
      kind: IMPORT_PLAN.INCOMPLETE,
      missing: ['source', 'figure', 'site'],
    });
    expect(plan(table, { columns: none, sites: ONE_SITE })).toEqual({
      kind: IMPORT_PLAN.INCOMPLETE,
      missing: ['source', 'figure'],
    });
  });

  it('refuses a sheet with no rows below its names, and one with more rows than allowed — the limit itself taken', () => {
    const row = ['Gaz', 'Brutăria', '1', 'mc', null];
    const atLimit = tableWith(...Array.from({ length: IMPORT_LIMITS.MAX_ROWS }, () => row));
    const overLimit = tableWith(...Array.from({ length: IMPORT_LIMITS.MAX_ROWS + 1 }, () => row));

    expect(plan(null)).toEqual({ kind: IMPORT_PLAN.REFUSED, refusal: SHEET_REFUSAL.NO_ROWS });
    expect(plan(tableWith())).toEqual({ kind: IMPORT_PLAN.REFUSED, refusal: SHEET_REFUSAL.NO_ROWS });
    expect(plan(overLimit)).toEqual({ kind: IMPORT_PLAN.REFUSED, refusal: SHEET_REFUSAL.TOO_MANY_ROWS });
    expect(plan(atLimit)).toMatchObject({ kind: IMPORT_PLAN.READY });
  });
});
