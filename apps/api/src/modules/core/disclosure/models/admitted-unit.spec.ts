import { unitIsAdmitted } from './admitted-unit';

describe('unitIsAdmitted (task 183)', () => {
  it('accepts a unit on the element’s stated list, and refuses one off it', () => {
    expect(unitIsAdmitted({ unitCode: 'MWh', admitted: ['MWh', 'GJ'] })).toBe(true);
    expect(unitIsAdmitted({ unitCode: 'kg', admitted: ['MWh', 'GJ'] })).toBe(false);
  });

  it('admits any unit where the standard states none — empty is not "takes no unit"', () => {
    expect(unitIsAdmitted({ unitCode: 'kg', admitted: [] })).toBe(true);
  });

  it('never refuses a value with no unit', () => {
    expect(unitIsAdmitted({ unitCode: null, admitted: ['MWh'] })).toBe(true);
  });
});
