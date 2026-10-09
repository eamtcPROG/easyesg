import { DERIVATION_FORMULA, OPERAND_SOURCE, type Derivation } from '../models/derivation.model';
import { derivationInputsFor } from './derivation-inputs';

/** Task 133.2: the derivation inputs a step shows — the ones its own figures read. */
describe('derivationInputsFor', () => {
  const accidentRate: Derivation = {
    element: 'RateOfRecordableWorkRelatedAccidents',
    formula: DERIVATION_FORMULA.ACCIDENT_RATE,
    operands: {
      accidents: { from: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfRecordableWorkRelatedAccidents', fallback: null },
      hours: { from: OPERAND_SOURCE.INPUT, key: 'HoursWorkedByOneFullTimeEmployee', fallback: '2000' },
      employees: { from: OPERAND_SOURCE.INPUT, key: 'AverageNumberOfEmployees', fallback: null },
    },
  };
  const turnover: Derivation = {
    element: 'EmployeeTurnoverRate',
    formula: DERIVATION_FORMULA.TURNOVER_RATE,
    operands: {
      departures: { from: OPERAND_SOURCE.INPUT, key: 'NumberOfEmployeesWhoLeft', fallback: null },
    },
  };
  const derivations = new Map([
    [accidentRate.element, accidentRate],
    [turnover.element, turnover],
  ]);

  it('offers the keyless inputs of the figures on this step, and no other step’s', () => {
    const fields = derivationInputsFor({
      elements: ['NumberOfRecordableWorkRelatedAccidents', 'RateOfRecordableWorkRelatedAccidents'],
      derivations,
      stored: new Map(),
    });

    // A disclosure operand is a field of its own; the turnover figure is not on this step.
    expect(fields.map((field) => field.key)).toEqual(['AverageNumberOfEmployees', 'HoursWorkedByOneFullTimeEmployee']);
    expect(fields.every((field) => field.derives === accidentRate.element)).toBe(true);
  });

  it('answers what is stored, and keeps the offer apart from the answer', () => {
    const fields = derivationInputsFor({
      elements: ['RateOfRecordableWorkRelatedAccidents'],
      derivations,
      stored: new Map([['AverageNumberOfEmployees', '48']]),
    });

    expect(fields).toEqual([
      {
        key: 'AverageNumberOfEmployees',
        derives: 'RateOfRecordableWorkRelatedAccidents',
        value: '48',
        offered: null,
      },
      {
        key: 'HoursWorkedByOneFullTimeEmployee',
        derives: 'RateOfRecordableWorkRelatedAccidents',
        value: null,
        offered: '2000',
      },
    ]);
  });

  it('offers nothing on a step none of whose figures is derived', () => {
    expect(derivationInputsFor({ elements: ['NumberOfEmployees'], derivations, stored: new Map() })).toEqual([]);
  });
});
