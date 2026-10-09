import { aStoredValue } from '../testing/step-read.fakes';
import { indexStored, keyOf } from './stored-values';

/** Task 133.2: the stored values, indexed for the wizard's reads. No store, no container. */
describe('indexStored', () => {
  it('gathers an element’s rows together, in the order the store gave them', () => {
    const second = aStoredValue({ elementKey: 'AddressOfSite', ordinal: 1, valueText: 'Str. Doi' });
    const first = aStoredValue({ elementKey: 'AddressOfSite', ordinal: 0, valueText: 'Str. Unu' });
    const other = aStoredValue({ elementKey: 'NumberOfEmployees', valueNumeric: '12' });

    const { byElement } = indexStored([second, other, first]);

    expect(byElement.get('AddressOfSite')).toEqual([second, first]);
    expect(byElement.get('NumberOfEmployees')).toEqual([other]);
    expect(byElement.has('CityOfSite')).toBe(false);
  });

  it('finds one row by its natural key', () => {
    const value = aStoredValue({ elementKey: 'EnergyConsumption', dimensionKey: 'RenewableMember', ordinal: 0 });

    const { byKey } = indexStored([value]);

    expect(byKey.get(keyOf({ elementKey: 'EnergyConsumption', dimensionKey: 'RenewableMember', ordinal: 0 }))).toBe(value);
    expect(byKey.get(keyOf({ elementKey: 'EnergyConsumption', dimensionKey: '', ordinal: 0 }))).toBeUndefined();
  });
});

describe('keyOf', () => {
  it('keeps apart two keys whose parts run together into the same characters', () => {
    // Without a separator both would read `A11`: element `A` under member `1` at the second row, and the undimensioned
    // element `A` at the twelfth — one field's value served to another.
    expect(keyOf({ elementKey: 'A', dimensionKey: '1', ordinal: 1 })).not.toBe(
      keyOf({ elementKey: 'A', dimensionKey: '', ordinal: 11 }),
    );
    expect(keyOf({ elementKey: 'AB', dimensionKey: '', ordinal: 0 })).not.toBe(
      keyOf({ elementKey: 'A', dimensionKey: 'B', ordinal: 0 }),
    );
  });
});
