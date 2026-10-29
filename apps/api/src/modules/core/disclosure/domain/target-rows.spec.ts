import type { TargetAxis } from '../models/target-axis';
import { answeredElsewhere, modulesAskingRow, targetRowsOn } from './target-rows';

/**
 * Which modules ask a row (task 79.3). The shipped registration's shape, written out: `ReportingScopesAxis` asked by C3
 * at its base and target years, beside the reporting year's row B3 asks.
 */
describe('how a target axis divides an element’s rows (task 79.3)', () => {
  const scopes: TargetAxis = {
    key: 'ReportingScopesAxis',
    module: 'C3',
    base: 'BaselineYearMember',
    target: 'TargetYearMember',
  };
  const targets = new Map([[scopes.key, scopes]]);
  const scope1 = { modules: ['B3', 'C3'], axes: ['ReportingScopesAxis'] };

  it('gives the base and the target year to the target module alone', () => {
    expect(modulesAskingRow({ element: scope1, dimensionKey: 'BaselineYearMember', targets })).toEqual(['C3']);
    expect(modulesAskingRow({ element: scope1, dimensionKey: 'TargetYearMember', targets })).toEqual(['C3']);
  });

  it('gives the reporting year — the undimensioned row — to the element’s other modules, and not to C3', () => {
    expect(modulesAskingRow({ element: scope1, dimensionKey: '', targets })).toEqual(['B3']);
  });

  it('leaves an element on no target axis to every module presenting it, every row', () => {
    const energy = { modules: ['B3'], axes: ['BreakdownOfEnergyConsumptionAxis'] };
    expect(modulesAskingRow({ element: energy, dimensionKey: 'RenewableEnergyMember', targets })).toEqual(['B3']);
    // With nothing registered, the eight emissions are what task 36.4 made them: both modules, every row.
    expect(modulesAskingRow({ element: scope1, dimensionKey: 'BaselineYearMember', targets: new Map() })).toEqual([
      'B3',
      'C3',
    ]);
  });

  it('shows the target module the reporting year first, then the base and the target year — the template’s columns', () => {
    expect(targetRowsOn({ element: scope1, module: 'C3', targets })).toEqual([
      '',
      'BaselineYearMember',
      'TargetYearMember',
    ]);
  });

  it('leaves every other module, and every element off a target axis, to the shapes it had', () => {
    expect(targetRowsOn({ element: scope1, module: 'B3', targets })).toBeNull();
    expect(targetRowsOn({ element: { axes: [] }, module: 'C3', targets })).toBeNull();
  });

  it('says the reporting year shown on C3 is answered on B3, and claims no other row elsewhere', () => {
    expect(answeredElsewhere({ element: scope1, dimensionKey: '', module: 'C3', targets })).toBe('B3');
    expect(answeredElsewhere({ element: scope1, dimensionKey: 'BaselineYearMember', module: 'C3', targets })).toBeNull();
    expect(answeredElsewhere({ element: scope1, dimensionKey: '', module: 'B3', targets })).toBeNull();
  });
});
