import { DERIVATION_FORMULA, OPERAND_SOURCE, type Derivation } from '../models/derivation.model';
import { inputsInScope } from './inputs-in-scope';

/** Task 254: the derivation inputs a validation run evaluates — the ones feeding a figure in the report's scope. */
describe('inputsInScope', () => {
  const coverage: Derivation = {
    element: 'PercentageOfEmployeesCoveredByCollectiveBargainingAgreements',
    formula: DERIVATION_FORMULA.SHARE_OF_HEADCOUNT,
    operands: {
      part: { from: OPERAND_SOURCE.INPUT, key: 'NumberOfEmployeesCoveredByCollectiveBargainingAgreements', fallback: null },
      whole: { from: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfEmployees', fallback: null },
    },
    along: null,
  };
  const payGap: Derivation = {
    element: 'PercentageGapInPayBetweenFemaleAndMaleEmployees',
    formula: DERIVATION_FORMULA.RELATIVE_GAP,
    operands: {
      reference: { from: OPERAND_SOURCE.INPUT, key: 'AverageGrossHourlyPayLevelOfMaleEmployees', fallback: null },
      compared: { from: OPERAND_SOURCE.INPUT, key: 'AverageGrossHourlyPayLevelOfFemaleEmployees', fallback: null },
    },
    along: null,
  };
  const accidentRate: Derivation = {
    element: 'RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod',
    formula: DERIVATION_FORMULA.ACCIDENT_RATE,
    operands: {
      accidents: { from: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod', fallback: null },
      hours: { from: OPERAND_SOURCE.INPUT, key: 'HoursWorkedByOneFullTimeEmployee', fallback: '2000' },
      employees: { from: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfEmployees', fallback: null },
    },
    along: null,
  };
  const derivations = new Map([coverage, payGap, accidentRate].map((derivation) => [derivation.element, derivation]));

  it('places each typed input of a figure in scope in that figure’s modules, with what is stored', () => {
    const inputs = inputsInScope({
      scope: new Map([[coverage.element, ['B10']]]),
      derivations,
      stored: new Map([['NumberOfEmployeesCoveredByCollectiveBargainingAgreements', '12']]),
    });

    // B1's headcount is a disclosure, in scope by its own placement, so it is not an input here.
    expect(inputs).toEqual([
      { key: 'NumberOfEmployeesCoveredByCollectiveBargainingAgreements', modules: ['B10'], value: '12' },
    ]);
  });

  it('leaves out every input of a figure out of scope — B10’s pay gap below 150 employees', () => {
    const inputs = inputsInScope({
      scope: new Map([[coverage.element, ['B10']]]),
      derivations,
      stored: new Map([['AverageGrossHourlyPayLevelOfMaleEmployees', '80']]),
    });

    expect(inputs.map((input) => input.key)).toEqual(['NumberOfEmployeesCoveredByCollectiveBargainingAgreements']);
  });

  it('answers null for an input nobody stored, an offered one included — the offer is not an answer', () => {
    const inputs = inputsInScope({ scope: new Map([[accidentRate.element, ['B9']]]), derivations, stored: new Map() });

    expect(inputs).toEqual([{ key: 'HoursWorkedByOneFullTimeEmployee', modules: ['B9'], value: null }]);
  });

  it('orders the inputs by key, whatever order the artefact lists them in', () => {
    const inputs = inputsInScope({
      scope: new Map([[payGap.element, ['B10']]]),
      derivations,
      stored: new Map(),
    });

    expect(inputs.map((input) => input.key)).toEqual([
      'AverageGrossHourlyPayLevelOfFemaleEmployees',
      'AverageGrossHourlyPayLevelOfMaleEmployees',
    ]);
  });
});
