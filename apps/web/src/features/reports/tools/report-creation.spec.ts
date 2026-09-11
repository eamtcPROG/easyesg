import { describe, expect, it } from 'vitest';
import { creationChoice } from './report-creation';

describe('creationChoice', () => {
  it('reads both choices from the address', () => {
    expect(creationChoice({ entity: 'e1', period: 'p1' })).toEqual({ entityId: 'e1', periodId: 'p1' });
  });

  it('answers undefined for a choice not yet made', () => {
    expect(creationChoice({})).toEqual({ entityId: undefined, periodId: undefined });
  });

  it('takes the first value of a repeated key', () => {
    expect(creationChoice({ entity: ['e1', 'e2'] })).toEqual({ entityId: 'e1', periodId: undefined });
  });
});
