import { describe, expect, it } from 'vitest';
import { compareText } from './collation';

/** OQ-61's ordering in the tenant tier: the root collation, so a Romanian name sorts among its letters, not after z. */
describe('compareText', () => {
  it('sorts a name with a comma-below letter beside its base letter, not after every ASCII one', () => {
    expect(['zoe', 'Țurcanu', 'Ștefan', 'Ana', 'Sorin'].toSorted(compareText)).toEqual([
      'Ana',
      'Sorin',
      'Ștefan',
      'Țurcanu',
      'zoe',
    ]);
  });

  it('orders without regard to case at the first difference', () => {
    expect(['beta', 'Alfa', 'alfa SRL', 'Beta'].toSorted(compareText).map((name) => name.toLowerCase())).toEqual([
      'alfa',
      'alfa srl',
      'beta',
      'beta',
    ]);
  });

  it('answers zero for the same text', () => {
    expect(compareText('Lina Logistică', 'Lina Logistică')).toBe(0);
  });
});
