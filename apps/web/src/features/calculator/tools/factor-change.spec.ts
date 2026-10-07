import { GHG_SCOPE, type Calculator } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { factorChange } from './factor-change';

const SCOPE_1 = 'GrossScope1GreenhouseGasEmissions';
const SCOPE_2 = 'GrossLocationBasedScope2GreenhouseGasEmissions';

const calculator = (latestRevision: number): Pick<Calculator, 'factorSet' | 'latestRun' | 'working'> => ({
  factorSet: { country: 'md', revision: 2, label: '2026.2', sources: [] },
  latestRun: {
    id: 'run',
    factorSet: { country: 'md', revision: latestRevision, label: latestRevision === 2 ? '2026.2' : '2026.1' },
    recordedAt: 0,
    results: [
      { elementKey: SCOPE_1, tonnesCo2e: '0.95' },
      { elementKey: SCOPE_2, tonnesCo2e: '0.63' },
    ],
  },
  working: {
    scopes: [
      { ghgScope: GHG_SCOPE.SCOPE_1, elementKey: SCOPE_1, tonnesCo2e: '0.96', unmeasured: [], lines: [] },
      { ghgScope: GHG_SCOPE.SCOPE_2_LOCATION_BASED, elementKey: SCOPE_2, tonnesCo2e: '0.58', unmeasured: [], lines: [] },
    ],
    uncovered: [],
  },
});

describe('factorChange (task 39.2; UX-44)', () => {
  it('names both sets and puts each B3 figure now beside what it would be', () => {
    expect(factorChange(calculator(1))).toEqual({
      pinned: '2026.1',
      current: '2026.2',
      figures: [
        { ghgScope: 'scope_1', now: '0.95', wouldBe: '0.96' },
        { ghgScope: 'scope_2_location_based', now: '0.63', wouldBe: '0.58' },
      ],
    });
  });

  it('says nothing when the latest run pinned the set in force, before any run, or without a set', () => {
    expect(factorChange(calculator(2))).toBeNull();
    expect(factorChange({ ...calculator(1), latestRun: null })).toBeNull();
    expect(factorChange({ ...calculator(1), factorSet: null, working: null })).toBeNull();
  });
});
