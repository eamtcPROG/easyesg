import { APPLICABILITY_CONDITION } from '../models/applicability.model';
import { aLabel } from '../testing/step-read.fakes';
import { moduleResolver, toCause } from './applicability-cause';

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

  const moduleOf = moduleResolver([
    { key: 'NumberOfEmployees', modules: ['B1'] },
    { key: 'GrossScope1GreenhouseGasEmissions', modules: ['B3', 'C3'] },
  ]);

  it('is null where no rule governs the element', () => {
    expect(toCause(undefined, { NumberOfEmployees: aLabel('Număr de angajați') }, moduleOf)).toBeNull();
  });

  it('names each driver from the catalogue, null where the catalogue has no word for it', () => {
    expect(toCause(evaluated, { NumberOfEmployees: aLabel('Număr de angajați') }, moduleOf)).toEqual({
      condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
      drivers: [
        { elementKey: 'NumberOfEmployees', label: 'Număr de angajați', module: 'B1' },
        // An element the version presents in no module names none, so the note links nowhere (task 80.1).
        { elementKey: 'TypeOfEmployeeCountingMethodology', label: null, module: null },
      ],
      threshold: '50',
      answer: '40',
    });
  });

  it('keeps the cause, unworded, where no catalogue was read', () => {
    expect(toCause(evaluated, null, moduleOf)?.drivers.map((driver) => driver.label)).toEqual([null, null]);
  });

  it('names an element in two modules by its first, the one its order describes (task 80.1)', () => {
    expect(moduleOf('GrossScope1GreenhouseGasEmissions')).toBe('B3');
  });
});
