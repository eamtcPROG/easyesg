import { LABEL_STANDING } from '@easyesg/i18n';
import { DERIVATION_FORMULA, OPERAND_SOURCE, type Derivation } from '../models/derivation.model';
import { derivationSources } from './derivation-sources';

/** Task 254: what a computed figure is worked out from, for S-07 to name while the figure waits on it. */
describe('derivationSources', () => {
  const accidentRate: Derivation = {
    element: 'RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod',
    formula: DERIVATION_FORMULA.ACCIDENT_RATE,
    operands: {
      accidents: { from: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod', fallback: null },
      hoursPerFullTimeEmployee: { from: OPERAND_SOURCE.INPUT, key: 'HoursWorkedByOneFullTimeEmployee', fallback: '2000' },
      employees: { from: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfEmployees', fallback: null },
    },
    along: null,
  };
  const coverage: Derivation = {
    element: 'PercentageOfEmployeesCoveredByCollectiveBargainingAgreements',
    formula: DERIVATION_FORMULA.SHARE_OF_HEADCOUNT,
    operands: {
      part: { from: OPERAND_SOURCE.INPUT, key: 'NumberOfEmployeesCoveredByCollectiveBargainingAgreements', fallback: null },
      whole: { from: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfEmployees', fallback: null },
    },
    along: null,
  };
  const catalogue = {
    NumberOfEmployees: { text: 'Number of employees', standing: LABEL_STANDING.OFFICIAL },
    NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod: {
      text: 'Number of recordable work-related accidents',
      standing: LABEL_STANDING.OFFICIAL,
    },
  };
  const moduleOf = (key: string): string | null =>
    ({ NumberOfEmployees: 'B1', NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod: 'B9' })[key] ?? null;

  it('names each disclosure operand by its label and the module that asks it, in the formula’s order', () => {
    expect(derivationSources({ derivation: accidentRate, catalogue, moduleOf })).toEqual([
      {
        source: OPERAND_SOURCE.DISCLOSURE,
        key: 'NumberOfRecordableWorkRelatedAccidentsInTheReportingPeriod',
        label: 'Number of recordable work-related accidents',
        module: 'B9',
      },
      { source: OPERAND_SOURCE.DISCLOSURE, key: 'NumberOfEmployees', label: 'Number of employees', module: 'B1' },
    ]);
  });

  it('leaves out an operand the platform offers a value for — the figure never waits on EFRAG’s 2 000 hours', () => {
    const keys = derivationSources({ derivation: accidentRate, catalogue, moduleOf }).map((source) => source.key);
    expect(keys).not.toContain('HoursWorkedByOneFullTimeEmployee');
  });

  it('gives an input its key alone, which the browser words and which sits beneath the figure', () => {
    expect(derivationSources({ derivation: coverage, catalogue, moduleOf })[0]).toEqual({
      source: OPERAND_SOURCE.INPUT,
      key: 'NumberOfEmployeesCoveredByCollectiveBargainingAgreements',
      label: null,
      module: null,
    });
  });

  it('is empty for a figure the platform does not compute', () => {
    expect(derivationSources({ derivation: undefined, catalogue, moduleOf })).toEqual([]);
  });
});
