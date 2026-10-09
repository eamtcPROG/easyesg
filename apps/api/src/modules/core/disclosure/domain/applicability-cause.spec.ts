import { APPLICABILITY_CONDITION } from '../models/applicability.model';
import { aLabel } from '../testing/step-read.fakes';
import { toCause } from './applicability-cause';

/** Task 133.2: a cause's drivers named in the reader's catalogue. */
describe('toCause', () => {
  const evaluated = {
    applicable: false,
    cause: {
      condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
      driverKeys: ['NumberOfEmployees', 'TypeOfEmployeeCountingMethodology'],
      threshold: '50',
      answer: '40',
    },
  };

  it('is null where no rule governs the element', () => {
    expect(toCause(undefined, { NumberOfEmployees: aLabel('Număr de angajați') })).toBeNull();
  });

  it('names each driver from the catalogue, null where the catalogue has no word for it', () => {
    expect(toCause(evaluated, { NumberOfEmployees: aLabel('Număr de angajați') })).toEqual({
      condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
      drivers: [
        { elementKey: 'NumberOfEmployees', label: 'Număr de angajați' },
        { elementKey: 'TypeOfEmployeeCountingMethodology', label: null },
      ],
      threshold: '50',
      answer: '40',
    });
  });

  it('keeps the cause, unworded, where no catalogue was read', () => {
    expect(toCause(evaluated, null)?.drivers.map((driver) => driver.label)).toEqual([null, null]);
  });
});
