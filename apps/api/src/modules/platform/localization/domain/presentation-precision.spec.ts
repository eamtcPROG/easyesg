import { presentationPrecisionRefusal, readElementPrecision, readPresentationPrecision } from './presentation-precision';

describe('readPresentationPrecision (task 39.2)', () => {
  it('reads the places by unit', () => {
    expect(readPresentationPrecision({ places: { tCO2e: 2, MWh: 2, kWh: 0 } })).toEqual({ tCO2e: 2, MWh: 2, kWh: 0 });
  });

  it.each([
    ['no payload', null],
    ['no places', {}],
    ['places as a list', { places: [2] }],
    ['a fractional places', { places: { tCO2e: 1.5 } }],
    ['a negative places', { places: { tCO2e: -1 } }],
    ['more places than any figure needs', { places: { tCO2e: 11 } }],
    ['places written as a string', { places: { tCO2e: '2' } }],
    ['a unit code that is not one', { places: { 't CO2e': 2 } }],
  ])('reads nothing from %s — whole or not at all', (_case, payload) => {
    expect(readPresentationPrecision(payload)).toBeNull();
    expect(presentationPrecisionRefusal(payload)).toEqual(expect.any(String));
  });

  it('refuses nothing the reader reads', () => {
    expect(presentationPrecisionRefusal({ places: { tCO2e: 2 } })).toBeNull();
  });
});

describe('readElementPrecision (task 46)', () => {
  it('reads the places of a figure computed with no unit, by its element, and none where the payload names none', () => {
    const payload = { places: { tCO2e: 2 }, elements: { EmployeeTurnoverRate: 2, Scope1AndScope2GreenhouseGasEmissionsIntensityValueLocationBased: 7 } };
    expect(readElementPrecision(payload)).toEqual({ EmployeeTurnoverRate: 2, Scope1AndScope2GreenhouseGasEmissionsIntensityValueLocationBased: 7 });
    expect(readElementPrecision({ places: { tCO2e: 2 } })).toEqual({});
    expect(presentationPrecisionRefusal(payload)).toBeNull();
  });

  it.each([
    ['elements as a list', { places: {}, elements: [2] }],
    ['a fractional places', { places: {}, elements: { EmployeeTurnoverRate: 0.5 } }],
    ['more places than any figure needs', { places: {}, elements: { EmployeeTurnoverRate: 11 } }],
    ['a key that is no element', { places: {}, elements: { 'employee turnover': 2 } }],
  ])('reads nothing from %s, and publication refuses it — whole or not at all', (_case, payload) => {
    expect(readElementPrecision(payload)).toBeNull();
    expect(readPresentationPrecision(payload)).toEqual({});
    expect(presentationPrecisionRefusal(payload)).toEqual(expect.any(String));
  });
});
