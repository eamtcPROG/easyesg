import type { FactorSet, FactorSource } from '../models/factor-set.model';
import { contentsRefusal, factorRefusal } from './calc-source-check';

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
});
