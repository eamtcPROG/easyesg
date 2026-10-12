import { presentedPlaces, presentedUnit } from './figure-precision';

const precision = { units: { tCO2e: 2, MWh: 2 }, elements: { EmployeeTurnoverRate: 2, Intensity: 7 } };
const field = (elementKey: string, unitCode: string | null, unitCodes: string[] = []) => ({ elementKey, unitCode, unitCodes });

describe('the digits a file shows a figure to (task-46 row (10))', () => {
  it('presents a figure in its stored unit, or — stored with none — in the one unit its element admits', () => {
    expect(presentedUnit(field('TotalEnergyConsumption', 'MWh', ['MWh']))).toBe('MWh');
    expect(presentedUnit(field('GrossScope1GreenhouseGasEmissions', null, ['tCO2e']))).toBe('tCO2e');
    expect(presentedUnit(field('AmountOfEmissionToAir', null, ['kg', 't']))).toBeNull();
    expect(presentedUnit(field('EmployeeTurnoverRate', null))).toBeNull();
  });

  it('rounds a calculated B3 figure at tonnes’ places, though it is stored with no unit', () => {
    expect(presentedPlaces({ field: field('GrossScope1GreenhouseGasEmissions', null, ['tCO2e']), precision })).toBe(2);
  });

  it('rounds a figure computed with no unit at its element’s places, and keeps every digit where none are set', () => {
    expect(presentedPlaces({ field: field('EmployeeTurnoverRate', null), precision })).toBe(2);
    expect(presentedPlaces({ field: field('Intensity', null), precision })).toBe(7);
    expect(presentedPlaces({ field: field('Turnover', null), precision })).toBeNull();
    expect(presentedPlaces({ field: field('AmountOfEmissionToAir', 'kg', ['kg', 't']), precision })).toBeNull();
  });
});
