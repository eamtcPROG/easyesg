import { GHG_SCOPE, type CalcFactorSource } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { IMPORT_PLAN, IMPORT_PROBLEM } from './import-plan';
import { wordsOf } from './import-text';
import { importView } from './import-view';

const source = (key: string, units: string[]): CalcFactorSource => ({
  key,
  units,
  ghgScope: GHG_SCOPE.SCOPE_1,
  megawattHoursPerUnit: Object.fromEntries(units.map((unit) => [unit, '1'])),
  emissionFactor: '1',
  reference: 'test',
});
const SOURCES = [source('natural_gas', ['m3']), source('electricity_grid', ['kWh', 'MWh'])];
const SITES = [
  { ordinal: 0, name: 'Brutăria' },
  { ordinal: 1, name: 'Magazinul' },
];
const WORDS = {
  source: wordsOf('sursa'),
  figure: wordsOf('cifra'),
  unit: wordsOf('unitate'),
  site: wordsOf('locatia'),
  description: wordsOf('descriere'),
};
const OPTIONS = {
  source: [
    { value: 'natural_gas', label: 'Gaze naturale' },
    { value: 'electricity_grid', label: 'Electricitate din rețea' },
  ],
  unit: [
    { value: 'm3', label: 'm³' },
    { value: 'kWh', label: 'kWh' },
    { value: 'MWh', label: 'MWh' },
  ],
  site: [
    { value: '0', label: 'Brutăria' },
    { value: '1', label: 'Magazinul' },
  ],
};
const ROWS = [
  ['Sursa', 'Cifra', 'Unitate', 'Locația'],
  ['Gaze naturale', '500', 'm3', 'Brutăria'],
  ['Curent', '1700', 'kWh', 'Magazinul'],
];

const view = (chosen: Parameters<typeof importView>[0]['chosen'] = { columns: {}, values: {} }) =>
  importView({ rows: ROWS, chosen, words: WORDS, options: OPTIONS, sources: SOURCES, sites: SITES });

describe('importView', () => {
  it('proposes the columns and the values it can, and plans from them, leaving the rest undecided', () => {
    const result = view();

    expect(result.columns).toEqual({ source: 0, figure: 1, unit: 2, site: 3, description: null });
    expect(result.matches.source).toEqual([
      { value: 'Gaze naturale', option: 'natural_gas', decided: true },
      { value: 'Curent', option: null, decided: false },
    ]);
    expect(result.plan).toEqual({
      kind: IMPORT_PLAN.READY,
      lines: [{ siteOrdinal: 0, sourceKey: 'natural_gas', description: null, quantity: '500', unitCode: 'm3' }],
      unreadable: [{ number: 3, problem: IMPORT_PROBLEM.SOURCE_UNMATCHED, value: 'Curent' }],
    });
  });

  it('plans from the reporter’s matches once they make them', () => {
    const result = view({ columns: {}, values: { source: { Curent: 'electricity_grid' } } });

    expect(result.matches.source[1]).toEqual({ value: 'Curent', option: 'electricity_grid', decided: true });
    expect(result.plan).toMatchObject({ lines: [{}, { siteOrdinal: 1, sourceKey: 'electricity_grid' }], unreadable: [] });
  });

  it('holds a match to none as decided, and its rows as unmatched', () => {
    const result = view({ columns: {}, values: { source: { 'Gaze naturale': null } } });

    expect(result.matches.source[0]).toEqual({ value: 'Gaze naturale', option: null, decided: true });
    expect(result.plan).toMatchObject({ unreadable: [{ number: 2, problem: IMPORT_PROBLEM.SOURCE_UNMATCHED }, {}] });
  });

  it('lists no value for a column the import does not read, nor a site’s for a report holding one', () => {
    expect(view({ columns: { unit: null }, values: {} }).matches.unit).toEqual([]);
    expect(
      importView({ rows: ROWS, chosen: { columns: {}, values: {} }, words: WORDS, options: OPTIONS, sources: SOURCES, sites: [SITES[0]] })
        .matches.site,
    ).toEqual([]);
  });

  it('plans nothing from a sheet holding nothing', () => {
    const empty = importView({ rows: [], chosen: { columns: {}, values: {} }, words: WORDS, options: OPTIONS, sources: SOURCES, sites: SITES });

    expect(empty.table).toBeNull();
    expect(empty.plan).toEqual({ kind: IMPORT_PLAN.REFUSED, refusal: 'no_rows' });
  });
});
