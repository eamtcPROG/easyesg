import { describe, expect, it } from 'vitest';
import { fieldsOf, withMonth, writeOf, type LineFields } from './line-write';

const gas: LineFields = {
  siteOrdinal: 0,
  sourceKey: 'natural_gas',
  description: 'Oven and boiler',
  quantity: '500',
  unitCode: 'm3',
  notAvailableReason: null,
  monthlyQuantities: null,
  overrideTonnes: null,
  overrideExplanation: null,
};

describe('writeOf (task 39.1)', () => {
  it('writes a figure with its unit, whole', () => {
    expect(writeOf(gas)).toEqual({
      siteOrdinal: 0,
      sourceKey: 'natural_gas',
      description: 'Oven and boiler',
      quantity: '500',
      unitCode: 'm3',
    });
  });

  it('writes months without a quantity — the server sums them — and keeps a line override with them', () => {
    const months = withMonth({ months: null, index: 0, value: '40', length: 12 });
    const monthly = { ...gas, quantity: '40', monthlyQuantities: months, overrideTonnes: '0.01', overrideExplanation: 'Metered' };
    expect(writeOf(monthly)).toEqual({
      siteOrdinal: 0,
      sourceKey: 'natural_gas',
      description: 'Oven and boiler',
      unitCode: 'm3',
      monthlyQuantities: months,
      overrideTonnes: '0.01',
      overrideExplanation: 'Metered',
    });
  });

  it('writes a reason with no figure, dropping an override that would have nothing to replace', () => {
    expect(writeOf({ ...gas, notAvailableReason: 'Billed by the landlord', overrideTonnes: '1', overrideExplanation: 'x' }))
      .toEqual({ siteOrdinal: 0, sourceKey: 'natural_gas', description: 'Oven and boiler', notAvailableReason: 'Billed by the landlord' });
  });

  it.each([
    ['no figure and no reason', { ...gas, quantity: null }],
    ['a figure with no unit', { ...gas, unitCode: null }],
    ['a blank reason', { ...gas, notAvailableReason: '  ' }],
    ['months with none entered', { ...gas, monthlyQuantities: Array.from({ length: 12 }, () => null) }],
  ])('sends nothing for %s, which the api would refuse', (_case, fields) => {
    expect(writeOf(fields)).toBeNull();
  });
});

describe('withMonth and fieldsOf (task 39.1)', () => {
  it('opens a twelve-row form at its first figure, and empties a month with null', () => {
    const first = withMonth({ months: null, index: 2, value: '38', length: 12 });
    expect(first).toHaveLength(12);
    expect(first[2]).toBe('38');
    expect(withMonth({ months: first, index: 2, value: null, length: 12 })[2]).toBeNull();
  });

  it('drops what only the screen knows, and who overrode the line, which only the server says (task 39.4)', () => {
    const by = { accountId: 'account-ana', name: 'Ana Popescu' };
    expect(fieldsOf({ ...gas, id: 'a', pending: true, overriddenBy: by })).toEqual(gas);
  });
});
