import { convertFigure, placedUnit } from './workbook-units';

/** Task-46 row (6): one unit a cell offers, the finest no larger than the figures' finest, reached exactly. */
describe('the unit a template cell is written in', () => {
  const mass = ['kg', 't'];
  const area = ['ha', 'm2'];

  it('keeps one stored unit the cell offers', () => {
    expect(placedUnit({ stored: ['t', 't'], offered: mass })).toBe('t');
    expect(placedUnit({ stored: ['ha'], offered: area })).toBe('ha');
  });

  it('writes figures in two units in the finer of them — B4’s air in kilogrammes beside its water in tonnes', () => {
    expect(placedUnit({ stored: ['t', 'kg'], offered: mass })).toBe('kg');
  });

  it('writes square kilometres, which B5’s cells do not offer, in hectares', () => {
    expect(placedUnit({ stored: ['sqkm'], offered: area })).toBe('ha');
    expect(placedUnit({ stored: ['sqkm', 'ha'], offered: area })).toBe('ha');
  });

  it('answers none for units of two kinds, or a unit it cannot size', () => {
    expect(placedUnit({ stored: ['kg', 'm3'], offered: [...mass, 'm3'] })).toBeNull();
    expect(placedUnit({ stored: ['MWh'], offered: mass })).toBeNull();
    expect(placedUnit({ stored: [], offered: mass })).toBeNull();
  });
});

describe('a figure converted between units', () => {
  it('moves the decimal point, exactly, whatever the digits', () => {
    expect(convertFigure({ value: '1.25', from: 't', to: 'kg' })).toBe('1250');
    expect(convertFigure({ value: '0.0004', from: 't', to: 'kg' })).toBe('0.4');
    expect(convertFigure({ value: '12', from: 'sqkm', to: 'ha' })).toBe('1200');
    expect(convertFigure({ value: '0.123456789012345', from: 'sqkm', to: 'ha' })).toBe('12.3456789012345');
    expect(convertFigure({ value: '-3', from: 't', to: 'kg' })).toBe('-3000');
    expect(convertFigure({ value: '7', from: 'kg', to: 'kg' })).toBe('7');
  });

  it('refuses units of two kinds', () => {
    expect(() => convertFigure({ value: '1', from: 'kg', to: 'ha' })).toThrow();
  });
});
