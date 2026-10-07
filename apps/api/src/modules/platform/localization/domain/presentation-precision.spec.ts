import { presentationPrecisionRefusal, readPresentationPrecision } from './presentation-precision';

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
