import { factorSetRefusal } from './factor-set-publication';

/** What publication refuses (task 37.4): everything the reader cannot use, a single dropped source included. */
describe('factorSetRefusal', () => {
  const gas = {
    key: 'natural_gas',
    ghgScope: 'scope_1',
    emissionFactor: '0.202559',
    units: { m3: '0.00928' },
    reference: 'IPCC 2006, Vol. 2, Ch. 2, Table 2.4',
  };

  it('admits a set the reader reads whole', () => {
    expect(factorSetRefusal({ label: '2026.2', sources: [gas] })).toBeNull();
  });

  it('refuses a set the reader rejects, saying why', () => {
    expect(factorSetRefusal({ sources: [gas] })).toBe('it carries no `label`');
    expect(factorSetRefusal({ label: '2026.2', sources: [gas, gas] })).toBe('it lists the source `natural_gas` twice');
  });

  /** The case the reader tolerates and publication does not: one source dropped, the rest readable. */
  it('refuses a set the reader would read with a source dropped, naming the source', () => {
    const numeric = { ...gas, key: 'diesel', emissionFactor: 0.268 };

    expect(factorSetRefusal({ label: '2026.2', sources: [gas, numeric] })).toBe(
      'it carries malformed source(s): diesel',
    );
  });
});
