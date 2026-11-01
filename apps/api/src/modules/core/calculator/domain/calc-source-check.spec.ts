import type { FactorSet, FactorSource } from '../models/factor-set.model';
import { contentsRefusal, factorRefusal, monthsRefusal, overrideRefusal } from './calc-source-check';

describe('an invoice line', () => {
  const measured = { quantity: '500', unitCode: 'm3', notAvailableReason: null };
  const explained = { quantity: null, unitCode: null, notAvailableReason: 'Billed by the landlord' };

  describe('contentsRefusal', () => {
    it('accepts a figure with its unit, and a reason with neither', () => {
      expect(contentsRefusal(measured)).toBeNull();
      expect(contentsRefusal(explained)).toBeNull();
      expect(contentsRefusal({ ...measured, quantity: '0' })).toBeNull();
    });

    it.each([
      ['a figure with no unit', { ...measured, unitCode: null }],
      ['a figure and a reason', { ...measured, notAvailableReason: 'Estimated' }],
      ['a reason with a unit', { ...explained, unitCode: 'kWh' }],
      ['a blank reason', { ...explained, notAvailableReason: '   ' }],
      ['nothing at all', { quantity: null, unitCode: null, notAvailableReason: null }],
      ['a figure written with a comma', { ...measured, quantity: '1700,5' }],
      ['a negative figure', { ...measured, quantity: '-5' }],
    ])('refuses %s', (_case, contents) => {
      expect(contentsRefusal(contents)).toBe('contents');
    });
  });

  describe('factorRefusal', () => {
    const gas: FactorSource = {
      key: 'natural_gas',
      ghgScope: 'scope_1',
      emissionFactor: '0.202544',
      units: new Map([['m3', '0.0095773']]),
      reference: 'IPCC 2006',
    };
    const factorSet: FactorSet = { pin: { country: 'md', revision: 1 }, label: '2026.1', sources: new Map([['natural_gas', gas]]) };

    it('accepts a source the set covers, in a unit it admits', () => {
      expect(factorRefusal({ sourceKey: 'natural_gas', contents: measured, factorSet })).toBeNull();
    });

    it('accepts an explained line on its source alone', () => {
      expect(factorRefusal({ sourceKey: 'natural_gas', contents: explained, factorSet })).toBeNull();
    });

    it('refuses a source the set does not cover', () => {
      expect(factorRefusal({ sourceKey: 'district_heating', contents: measured, factorSet })).toBe('source');
    });

    it('refuses a unit the source is not entered in', () => {
      expect(factorRefusal({ sourceKey: 'natural_gas', contents: { ...measured, unitCode: 'Gcal' }, factorSet })).toBe(
        'unit',
      );
    });
  });

  describe('overrideRefusal', () => {
    const replacement = { tonnesCo2e: '0.84', explanation: 'Sub-leased from March' };

    it('accepts no override, and a measured line’s replacement with its reason', () => {
      expect(overrideRefusal({ contents: measured, override: null })).toBeNull();
      expect(overrideRefusal({ contents: measured, override: replacement })).toBeNull();
    });

    it.each([
      ['a replacement with no reason', { contents: measured, override: { ...replacement, explanation: '  ' } }],
      ['a replacement written with a comma', { contents: measured, override: { ...replacement, tonnesCo2e: '0,84' } }],
      ['a replacement on an explained line, which has nothing computed', { contents: explained, override: replacement }],
    ])('refuses %s', (_case, input) => {
      expect(overrideRefusal(input)).toBe('override');
    });
  });

  describe('monthsRefusal (task 39.1)', () => {
    // A monthly line as a client writes it: months and a unit, the quantity left for the server to sum.
    const monthly = { quantity: null, unitCode: 'm3', notAvailableReason: null };
    const months = (entered: Readonly<Record<number, string | number>>): (string | null)[] =>
      Array.from({ length: 12 }, (_, index) => (entered[index] === undefined ? null : String(entered[index])));

    it('accepts a line with no months, and twelve months with one or more entered and the rest empty', () => {
      expect(monthsRefusal({ contents: measured, monthlyQuantities: null })).toBeNull();
      expect(monthsRefusal({ contents: monthly, monthlyQuantities: months({ 0: 40, 1: 45 }) })).toBeNull();
      expect(monthsRefusal({ contents: monthly, monthlyQuantities: months({ 11: 0 }) })).toBeNull();
    });

    it.each([
      ['eleven months', { contents: monthly, monthlyQuantities: months({ 0: 40 }).slice(1) }],
      ['thirteen months', { contents: monthly, monthlyQuantities: [...months({ 0: 40 }), '5'] }],
      ['every month empty', { contents: monthly, monthlyQuantities: months({}) }],
      ['a month written with a comma', { contents: monthly, monthlyQuantities: months({ 0: '40,5' }) }],
      ['a negative month', { contents: monthly, monthlyQuantities: months({ 0: '-4' }) }],
      ['a quantity sent beside them', { contents: measured, monthlyQuantities: months({ 0: 40 }) }],
      ['no unit', { contents: { ...monthly, unitCode: null }, monthlyQuantities: months({ 0: 40 }) }],
      ['a reason beside them', { contents: { ...monthly, notAvailableReason: 'Billed' }, monthlyQuantities: months({ 0: 40 }) }],
    ])('refuses %s', (_case, input) => {
      expect(monthsRefusal(input)).toBe('months');
    });
  });
});
