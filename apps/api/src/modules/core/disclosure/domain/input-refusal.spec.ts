import {
  DerivationInputNotYesOrNoError,
  DisclosureOutOfScopeError,
  UnknownDerivationInputError,
} from '../errors/report.errors';
import { DERIVATION_FORMULA, OPERAND_SOURCE, type Derivation, type DerivationFormula } from '../models/derivation.model';
import { REPORT_SCOPE } from '../models/report.model';
import { inputRefusal } from './input-refusal';

/** What a derivation input write refuses of each input (tasks 36.10, 79.5, 79.8). */
describe('inputRefusal', () => {
  const derivation = (element: string, formula: DerivationFormula, key: string): Derivation => ({
    element,
    formula,
    operands: { only: { from: OPERAND_SOURCE.INPUT, key, fallback: null } },
    along: null,
  });
  const derivations = new Map(
    [
      derivation('EmployeeTurnoverRate', DERIVATION_FORMULA.TURNOVER_RATE, 'Departures'),
      derivation('FemaleToMaleRatioAtManagementLevelForTheReportingPeriod', DERIVATION_FORMULA.RATIO, 'FemaleManagers'),
      derivation('ExcludedFromBenchmarks', DERIVATION_FORMULA.ANY_AFFIRMED, 'OnePercentFromCoal'),
    ].map((entry) => [entry.element, entry]),
  );
  const modules: Readonly<Record<string, readonly string[]>> = {
    EmployeeTurnoverRate: ['B8'],
    FemaleToMaleRatioAtManagementLevelForTheReportingPeriod: ['C5'],
    ExcludedFromBenchmarks: ['C8'],
  };
  const judged = (
    inputKey: string,
    valueNumeric: string | null,
    scope: typeof REPORT_SCOPE.BASIC | typeof REPORT_SCOPE.BASIC_AND_COMPREHENSIVE = REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
  ) => inputRefusal({ inputKey, valueNumeric, derivations, modulesOf: (key) => modules[key] ?? [], scope });

  it('admits an input of a figure the scope asks, a number or a clearing', () => {
    expect(judged('Departures', '3', REPORT_SCOPE.BASIC)).toBeNull();
    expect(judged('FemaleManagers', '2')).toBeNull();
    expect(judged('FemaleManagers', null)).toBeNull();
  });

  it('refuses a key no registered formula reads', () => {
    expect(judged('NotAnInput', '1')).toBeInstanceOf(UnknownDerivationInputError);
  });

  it('refuses an input of a Comprehensive figure on a Basic report, as a C answer is (UC-192)', () => {
    expect(judged('FemaleManagers', '2', REPORT_SCOPE.BASIC)).toBeInstanceOf(DisclosureOutOfScopeError);
    expect(judged('OnePercentFromCoal', '1', REPORT_SCOPE.BASIC)).toBeInstanceOf(DisclosureOutOfScopeError);
  });

  it('admits a yes/no input only as 1 or 0, and its clearing', () => {
    expect(judged('OnePercentFromCoal', '1')).toBeNull();
    expect(judged('OnePercentFromCoal', '0')).toBeNull();
    expect(judged('OnePercentFromCoal', null)).toBeNull();
    expect(judged('OnePercentFromCoal', '2')).toBeInstanceOf(DerivationInputNotYesOrNoError);
    expect(judged('OnePercentFromCoal', '1.0')).toBeInstanceOf(DerivationInputNotYesOrNoError);
  });

  it('holds no number input to yes or no', () => {
    expect(judged('FemaleManagers', '2')).toBeNull();
  });
});
