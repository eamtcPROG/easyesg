import { GHG_SCOPE, LINE_OUTCOME } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { computationOf } from './computation';

describe('computationOf (task 39.2)', () => {
  it('reads the figures, the uncovered lines, the set’s label and the places once', () => {
    const computation = computationOf({
      factorSet: { country: 'md', revision: 1, label: '2026.1', sources: [] },
      precision: { tCO2e: 2 },
      working: {
        scopes: [
          {
            ghgScope: GHG_SCOPE.SCOPE_1,
            elementKey: 'a',
            tonnesCo2e: '1',
            unmeasured: [],
            lines: [
              { sourceId: 'gas', outcome: LINE_OUTCOME.COMPUTED, megawattHours: '1', tonnesCo2e: '1', computedTonnesCo2e: null, explanation: null },
            ],
          },
        ],
        uncovered: ['old'],
      },
    });
    expect(computation.results.has('gas')).toBe(true);
    expect(computation.uncovered.has('old')).toBe(true);
    expect(computation.setLabel).toBe('2026.1');
    expect(computation.precision).toEqual({ tCO2e: 2 });
  });

  it('has no label and no figures without a set', () => {
    const computation = computationOf({ factorSet: null, working: null, precision: {} });
    expect(computation.setLabel).toBeNull();
    expect(computation.results.size).toBe(0);
  });
});
