import { evaluationScope, rolledUpModules } from './evaluation-scope';
import { REPORT_SCOPE, scopeAsks } from './report.model';

/**
 * Which elements a validation run evaluates, and where each counts (task 41.2; FR-28, FR-31, FR-177; §12.5.6's
 * task-41 row (4), (h)) — every way an element leaves the scope, one case each.
 */
describe('evaluationScope', () => {
  const elements = [
    { key: 'Turnover', modules: ['B1'] },
    { key: 'NumberOfMaleEmployees', modules: ['B8'] },
    { key: 'GrossScope1GreenhouseGasEmissions', modules: ['B3', 'C3'] },
    { key: 'DescriptionOfMainBusinessRelationships', modules: ['C1'] },
    { key: 'DisclosureOfAnyOtherSocialAndOrEntitySpecificSocialDisclosures', modules: [] },
  ];
  const none = new Set<string>();
  const scopeOf = (over: Partial<Parameters<typeof evaluationScope>[0]> = {}) =>
    evaluationScope({
      elements,
      reportScope: REPORT_SCOPE.BASIC,
      inapplicable: none,
      omittedModules: none,
      withheld: none,
      ...over,
    });

  it('holds every element a Basic report asks, each in its module, and no Comprehensive one', () => {
    expect(Object.fromEntries(scopeOf())).toEqual({
      Turnover: ['B1'],
      NumberOfMaleEmployees: ['B8'],
      GrossScope1GreenhouseGasEmissions: ['B3'],
    });
  });

  it('counts an element B3 and C3 share in both once the report asks the Comprehensive Module', () => {
    const scope = scopeOf({ reportScope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE });
    expect(scope.get('GrossScope1GreenhouseGasEmissions')).toEqual(['B3', 'C3']);
    expect(scope.get('DescriptionOfMainBusinessRelationships')).toEqual(['C1']);
  });

  it('leaves out an element that does not apply (FR-28)', () => {
    expect(scopeOf({ inapplicable: new Set(['Turnover']) }).has('Turnover')).toBe(false);
  });

  it('leaves out an element a declared section withholds (FR-31 AC-3)', () => {
    expect(scopeOf({ withheld: new Set(['NumberOfMaleEmployees']) }).has('NumberOfMaleEmployees')).toBe(false);
  });

  it('leaves out a module declared omitted, and keeps a shared element in the module that stands', () => {
    const scope = scopeOf({
      reportScope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
      omittedModules: new Set(['B8', 'B3']),
    });
    expect(scope.has('NumberOfMaleEmployees')).toBe(false);
    expect(scope.get('GrossScope1GreenhouseGasEmissions')).toEqual(['C3']);
  });

  it('leaves out an element no module presents, which no step could answer', () => {
    expect(scopeOf({ reportScope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE }).has(
      'DisclosureOfAnyOtherSocialAndOrEntitySpecificSocialDisclosures',
    )).toBe(false);
  });
});

/** The modules a roll-up lists (task 41.3; FR-41 item 2): waiting ones stay, ruled-out ones leave. */
describe('rolledUpModules', () => {
  const elements = [
    { key: 'Turnover', modules: ['B1'] },
    { key: 'TotalAmountOfWaterWithdrawnFromAllSites', modules: ['B6'] },
    { key: 'TotalWaterConsumption', modules: ['B6'] },
    { key: 'NumberOfMaleEmployees', modules: ['B8'] },
    { key: 'DescriptionOfMainBusinessRelationships', modules: ['C1'] },
  ];
  const listed = (over: Partial<Parameters<typeof rolledUpModules>[0]> = {}) =>
    rolledUpModules({
      elements,
      moduleOrder: ['B1', 'B6', 'B8', 'C1'],
      reportScope: REPORT_SCOPE.BASIC,
      omittedModules: new Set(),
      ruledOut: new Set(),
      ...over,
    });

  it('lists every module asked and not omitted, in the version’s order, waiting ones included', () => {
    expect(listed()).toEqual(['B1', 'B6', 'B8']);
  });

  it('leaves out a module FR-28 has ruled out whole, and keeps one only partly ruled out', () => {
    expect(listed({ ruledOut: new Set(['TotalAmountOfWaterWithdrawnFromAllSites', 'TotalWaterConsumption']) })).toEqual(
      ['B1', 'B8'],
    );
    expect(listed({ ruledOut: new Set(['TotalWaterConsumption']) })).toEqual(['B1', 'B6', 'B8']);
  });

  it('leaves out a module declared omitted, and a Comprehensive one a Basic report does not ask', () => {
    expect(listed({ omittedModules: new Set(['B8']) })).toEqual(['B1', 'B6']);
    expect(listed({ reportScope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE })).toEqual(['B1', 'B6', 'B8', 'C1']);
  });
});

describe('scopeAsks', () => {
  it('asks a Basic report the B modules only, and a Comprehensive one every module', () => {
    expect(scopeAsks({ scope: REPORT_SCOPE.BASIC, module: 'B11' })).toBe(true);
    expect(scopeAsks({ scope: REPORT_SCOPE.BASIC, module: 'C1' })).toBe(false);
    expect(scopeAsks({ scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE, module: 'C1' })).toBe(true);
    expect(scopeAsks({ scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE, module: 'B1' })).toBe(true);
  });
});
