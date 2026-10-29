import { APPLICABILITY_CONDITION, type ApplicabilityRule } from '../models/applicability.model';
import { stepDrivers } from './step-drivers';

/** Which of a step's fields decide another on the same step (task 80.1). */
describe('stepDrivers', () => {
  const rules: ApplicabilityRule[] = [
    { elements: ['URL'], condition: { kind: APPLICABILITY_CONDITION.IS_TRUE, elementKey: 'Published' } },
    { elements: ['TurnoverRate'], condition: { kind: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST, elementKey: 'Headcount', threshold: '50' } },
    { elements: ['Biodiversity'], condition: { kind: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED, elementKeys: ['City', 'Gps'] } },
  ];

  it('names a driver whose governed field is on the same step', () => {
    expect([...stepDrivers({ rules, onStep: new Set(['Published', 'URL', 'Emissions']) })]).toEqual(['Published']);
  });

  it('names no driver on another step — B1’s headcount for B8 is read when B8 is', () => {
    expect([...stepDrivers({ rules, onStep: new Set(['TurnoverRate']) })]).toEqual([]);
    expect([...stepDrivers({ rules, onStep: new Set(['Headcount']) })]).toEqual([]);
  });

  it('names each of a rule’s drivers that is on the step', () => {
    expect([...stepDrivers({ rules, onStep: new Set(['Biodiversity', 'City']) })]).toEqual(['City']);
  });
});
