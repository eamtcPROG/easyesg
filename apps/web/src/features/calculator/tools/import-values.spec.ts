import { describe, expect, it } from 'vitest';
import { GHG_SCOPE } from '@easyesg/contracts';
import { distinctValues, proposeOption, unitsOf } from './import-values';

const SOURCES = [
  { value: 'natural_gas', label: 'Gaze naturale' },
  { value: 'lpg', label: 'Gaz lichefiat (GPL), în butelii sau rezervor' },
  { value: 'lpg_road', label: 'Gaz lichefiat (GPL) pentru vehicule' },
  { value: 'diesel_road', label: 'Motorină pentru vehicule' },
  { value: 'electricity_grid', label: 'Electricitate din rețea' },
];
const UNITS = [
  { value: 'm3', label: 'm³' },
  { value: 'l', label: 'litri' },
  { value: 'kWh', label: 'kWh' },
];
const SITES = [
  { value: '0', label: 'Brutăria' },
  { value: '1', label: 'Magazinul' },
];

describe('distinctValues', () => {
  it('lists each value a column holds once, in the order it first appears, skipping empty cells', () => {
    const table = {
      headers: ['Sursa', 'Cifra'],
      rows: [
        { number: 2, cells: ['Gaz', '1'] },
        { number: 3, cells: [null, '2'] },
        { number: 4, cells: ['Motorină', '3'] },
        { number: 5, cells: ['Gaz', '4'] },
        { number: 6, cells: ['gaz', '5'] },
      ],
    };

    expect(distinctValues({ table, column: 0 })).toEqual(['Gaz', 'Motorină', 'gaz']);
  });
});

describe('proposeOption', () => {
  it('proposes the option whose name the value reads as, case and accents aside', () => {
    expect(proposeOption({ value: 'GAZE NATURALE', options: SOURCES, byCode: true })).toBe('natural_gas');
    expect(proposeOption({ value: 'Electricitate din retea', options: SOURCES, byCode: true })).toBe(
      'electricity_grid',
    );
    expect(proposeOption({ value: 'm3', options: UNITS, byCode: true })).toBe('m3');
    expect(proposeOption({ value: 'Litri', options: UNITS, byCode: true })).toBe('l');
  });

  it('proposes a source or a unit by its code, as another tool may write it', () => {
    expect(proposeOption({ value: 'natural_gas', options: SOURCES, byCode: true })).toBe('natural_gas');
    expect(proposeOption({ value: 'KWH', options: UNITS, byCode: true })).toBe('kWh');
  });

  it('never proposes a site by its code, which is a position', () => {
    expect(proposeOption({ value: '1', options: SITES, byCode: false })).toBeNull();
    expect(proposeOption({ value: 'magazinul', options: SITES, byCode: false })).toBe('1');
  });

  it('proposes the one option a value is part of, or that is part of it — and nothing where several are', () => {
    expect(proposeOption({ value: 'Motorină', options: SOURCES, byCode: true })).toBe('diesel_road');
    expect(proposeOption({ value: 'Brutăria, str. Alba Iulia 21', options: SITES, byCode: false })).toBe('0');
    // Three gas sources hold `gaz` as a word: guessing one would put rows on a line nobody chose.
    expect(proposeOption({ value: 'Gaz', options: SOURCES, byCode: true })).toBeNull();
  });

  it('proposes nothing for a value it cannot read as any option', () => {
    expect(proposeOption({ value: 'mc', options: UNITS, byCode: true })).toBeNull();
    expect(proposeOption({ value: '—', options: UNITS, byCode: true })).toBeNull();
  });
});

describe('unitsOf', () => {
  const source = (key: string, units: string[]) => ({
    key,
    units,
    ghgScope: GHG_SCOPE.SCOPE_1,
    megawattHoursPerUnit: {},
    emissionFactor: '1',
    reference: 'test',
  });

  it('lists every unit the sources admit, each once, in the order they are named', () => {
    expect(unitsOf([source('diesel', ['l']), source('lpg', ['kg', 'l']), source('electricity_grid', ['kWh', 'MWh'])])).toEqual([
      'l',
      'kg',
      'kWh',
      'MWh',
    ]);
  });
});
