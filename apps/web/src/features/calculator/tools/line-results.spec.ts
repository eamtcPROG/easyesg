import { GHG_SCOPE, LINE_OUTCOME, type CalcWorking } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { lineResults } from './line-results';

const line = (sourceId: string) => ({
  sourceId,
  outcome: LINE_OUTCOME.COMPUTED,
  megawattHours: '4.78865',
  tonnesCo2e: '0.9699123256',
  computedTonnesCo2e: null,
  explanation: null,
});

describe('lineResults (task 39.2)', () => {
  it('finds each line’s figures across both scopes by its id', () => {
    const working: CalcWorking = {
      scopes: [
        { ghgScope: GHG_SCOPE.SCOPE_1, elementKey: 'a', tonnesCo2e: '1', unmeasured: [], lines: [line('gas')] },
        { ghgScope: GHG_SCOPE.SCOPE_2_LOCATION_BASED, elementKey: 'b', tonnesCo2e: null, unmeasured: [], lines: [line('grid')] },
      ],
      uncovered: [],
    };
    const results = lineResults(working);
    expect([...results.keys()]).toEqual(['gas', 'grid']);
    expect(results.get('gas')?.tonnesCo2e).toBe('0.9699123256');
  });

  it('has nothing for a line the server has not computed, and nothing at all without a set', () => {
    expect(lineResults(null).size).toBe(0);
  });
});
