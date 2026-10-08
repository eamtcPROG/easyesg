import { COMPARABILITY, type PriorPeriodValue } from '@api/modules/core/comparatives/models/prior-period-value.model';
import { comparablePrior } from './comparable-prior';

const prior = (comparability: PriorPeriodValue['comparability']): PriorPeriodValue => ({
  elementKey: 'NumberOfEmployees',
  dimensionKey: '',
  ordinal: 0,
  valueNumeric: '20',
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: 'ok',
  comparability,
});

describe('comparablePrior (FR-46 item 3)', () => {
  it('keeps a comparable prior value, and drops one whose element or shape moved between versions', () => {
    const kept = comparablePrior([
      prior(COMPARABILITY.COMPARABLE),
      prior(COMPARABILITY.ELEMENT_ABSENT),
      prior(COMPARABILITY.SHAPE_CHANGED),
    ]);
    expect(kept).toEqual([prior(COMPARABILITY.COMPARABLE)]);
  });
});
