import { GHG_SCOPE, type CalcFactorSource, type GhgScope } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { sourceGroups } from './source-groups';

const source = (key: string, ghgScope: GhgScope): CalcFactorSource => ({
  key,
  ghgScope,
  units: ['u'],
  megawattHoursPerUnit: { u: '1' },
  emissionFactor: '0.1',
  reference: 'A publication',
});

describe('sourceGroups (task 39.1)', () => {
  it('groups the sources by the B3 figure they count toward, fuels first, in the set’s own order', () => {
    const groups = sourceGroups([
      source('electricity_grid', GHG_SCOPE.SCOPE_2_LOCATION_BASED),
      source('natural_gas', GHG_SCOPE.SCOPE_1),
      source('diesel', GHG_SCOPE.SCOPE_1),
    ]);
    expect(groups.map((group) => [group.scope, group.sources.map((source) => source.key)])).toEqual([
      ['scope_1', ['natural_gas', 'diesel']],
      ['scope_2_location_based', ['electricity_grid']],
    ]);
  });

  it('drops a group no source falls in', () => {
    expect(sourceGroups([source('diesel', GHG_SCOPE.SCOPE_1)])).toHaveLength(1);
  });
});
