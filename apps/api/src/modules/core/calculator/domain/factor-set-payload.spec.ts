import { readFactorSetPayload } from './factor-set-payload';

/**
 * The payload rules (task 37.1), stated as cases: what a published factor set must carry, which defects drop one
 * source and which make the whole set unreadable.
 */
describe('readFactorSetPayload', () => {
  const gas = {
    key: 'natural_gas',
    ghgScope: 'scope_1',
    emissionFactor: '0.202559',
    units: { m3: '0.00928', MWh: '1' },
    reference: 'IPCC 2006, Vol. 2, Ch. 2, Table 2.4',
  };
  const grid = {
    key: 'electricity_grid',
    ghgScope: 'scope_2_location_based',
    emissionFactor: '0.5',
    units: { kWh: '0.001' },
    reference: 'National grid factor',
  };

  it('reads a set whole, keeping its sources in the order they were published', () => {
    const reading = readFactorSetPayload({ label: '2026.1', sources: [gas, grid] });

    expect(reading.readable).toBe(true);
    if (!reading.readable) return;
    expect(reading.label).toBe('2026.1');
    expect([...reading.sources.keys()]).toEqual(['natural_gas', 'electricity_grid']);
    expect(reading.sources.get('natural_gas')).toEqual({
      key: 'natural_gas',
      ghgScope: 'scope_1',
      emissionFactor: '0.202559',
      units: new Map([
        ['m3', '0.00928'],
        ['MWh', '1'],
      ]),
      reference: 'IPCC 2006, Vol. 2, Ch. 2, Table 2.4',
    });
    expect(reading.dropped).toEqual([]);
  });

  it.each([
    ['a factor written as a number', { ...gas, emissionFactor: 0.202559 }],
    ['a factor in exponent form', { ...gas, emissionFactor: '2.02559e-1' }],
    ['a negative factor', { ...gas, emissionFactor: '-0.2' }],
    ['a scope outside the vocabulary', { ...gas, ghgScope: 'scope_2_market_based' }],
    ['no reference', { ...gas, reference: '  ' }],
    ['no units', { ...gas, units: {} }],
    ['a unit converting to no energy', { ...gas, units: { m3: '0' } }],
    ['a unit converting as a number', { ...gas, units: { m3: 0.00928 } }],
    ['a key that cannot be a catalogue path', { ...gas, key: 'Natural Gas' }],
  ])('drops a source with %s, and keeps the rest', (_case, source) => {
    const reading = readFactorSetPayload({ label: '2026.1', sources: [source, grid] });

    expect(reading.readable).toBe(true);
    if (!reading.readable) return;
    expect([...reading.sources.keys()]).toEqual(['electricity_grid']);
    expect(reading.dropped).toHaveLength(1);
  });

  it('accepts a zero emission factor, which a source can genuinely carry', () => {
    const reading = readFactorSetPayload({ label: '2026.1', sources: [{ ...gas, emissionFactor: '0' }] });
    expect(reading.readable && reading.sources.get('natural_gas')?.emissionFactor).toBe('0');
  });

  it.each([
    ['a payload that is not an object', ['natural_gas']],
    ['no label', { sources: [gas] }],
    ['no sources array', { label: '2026.1', sources: { natural_gas: gas } }],
    ['no readable source', { label: '2026.1', sources: [{ ...gas, units: {} }] }],
    ['one source listed twice', { label: '2026.1', sources: [gas, { ...gas, emissionFactor: '0.3' }] }],
  ])('refuses the whole set for %s', (_case, payload) => {
    expect(readFactorSetPayload(payload)).toMatchObject({ readable: false });
  });
});
