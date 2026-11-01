import { SHIPPED_LIKE_SET } from '../testing/calculator.fakes';
import type { CalcSource } from '../models/calc-source.model';
import { workingResults } from './working-results';

const line = (sourceId: string, overrides: Partial<CalcSource>): CalcSource => ({
  reportId: 'report',
  sourceId,
  siteOrdinal: 0,
  sourceKey: 'natural_gas',
  description: null,
  contents: { quantity: '500', unitCode: 'm3', notAvailableReason: null },
  monthlyQuantities: null,
  override: null,
  overriddenBy: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

describe('workingResults (task 39.2)', () => {
  it('computes the lines as a run would — the same scopes, the same exact figures', () => {
    const { scopes, uncovered } = workingResults({
      sources: [
        line('gas', {}),
        line('grid', { sourceKey: 'electricity_grid', contents: { quantity: '17000', unitCode: 'kWh', notAvailableReason: null } }),
      ],
      factorSet: SHIPPED_LIKE_SET,
    });
    expect(uncovered).toEqual([]);
    // 500 m³ × 0.0095773 MWh/m³ × 0.202544 t/MWh, and 17 000 kWh × 0.001 × 0.594645 — the 38.2 and 38.3 figures.
    expect(scopes.map((scope) => [scope.ghgScope, scope.tonnesCo2e])).toEqual([
      ['scope_1', '0.9699123256'],
      ['scope_2_location_based', '10.108965'],
    ]);
  });

  it('sets aside a line the set no longer covers, and names it, rather than failing the read', () => {
    const { scopes, uncovered } = workingResults({
      sources: [line('gas', {}), line('heat', { sourceKey: 'district_heating' }), line('gcal', { contents: { quantity: '1', unitCode: 'Gcal', notAvailableReason: null } })],
      factorSet: SHIPPED_LIKE_SET,
    });
    expect(uncovered).toEqual(['heat', 'gcal']);
    expect(scopes[0]?.lines.map((each) => each.sourceId)).toEqual(['gas']);
  });

  it('has no total for a scope with nothing measured — never zero', () => {
    const { scopes } = workingResults({ sources: [], factorSet: SHIPPED_LIKE_SET });
    expect(scopes.map((scope) => scope.tonnesCo2e)).toEqual([null, null]);
  });
});
