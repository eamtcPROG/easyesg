import type { AxisShapes } from '../interfaces/axis-shape.interface';
import type { DerivationInputStore } from '../interfaces/derivation-input-store.interface';
import type { Derivations } from '../interfaces/derivation.interface';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import { DERIVATION_FORMULA, OPERAND_SOURCE, type Derivation } from '../models/derivation.model';
import type { DisclosureValue, DisclosureValueKey } from '../models/disclosure-value.model';
import type { TargetAxis } from '../models/target-axis';
import { aStoredValue } from '../testing/step-read.fakes';
import { DerivationCalculator } from './derivation-calculator.service';

/**
 * A derivation worked out at a target axis' years as well as the reporting year (task 79.3; §12.5.6's task-79.3 row) —
 * B3's location-based Scope 1 and Scope 2 total, which C3 asks at its base and target years.
 */
describe('DerivationCalculator along a target axis (task 79.3)', () => {
  const SCOPES: TargetAxis = {
    key: 'ReportingScopesAxis',
    module: 'C3',
    base: 'BaselineYearMember',
    target: 'TargetYearMember',
  };
  const total = (along: string | null): Derivation => ({
    element: 'TotalGrossLocationBasedScope1AndScope2GHGEmissions',
    formula: DERIVATION_FORMULA.SUM,
    operands: {
      scope1: { from: OPERAND_SOURCE.DISCLOSURE, key: 'GrossScope1GreenhouseGasEmissions', fallback: null },
      scope2: { from: OPERAND_SOURCE.DISCLOSURE, key: 'GrossLocationBasedScope2GreenhouseGasEmissions', fallback: null },
    },
    along,
  });
  const figure = (elementKey: string, dimensionKey: string, valueNumeric: string) =>
    aStoredValue({ elementKey, dimensionKey, valueNumeric });

  const run = async (input: {
    readonly derivation: Derivation;
    readonly targets: ReadonlyMap<string, TargetAxis>;
    readonly stored: readonly DisclosureValue[];
  }) => {
    const written: { key: DisclosureValueKey; valueNumeric: string | null }[] = [];
    const calculator = new DerivationCalculator(
      { all: () => new Map([[input.derivation.element, input.derivation]]) } as unknown as Derivations,
      {
        forReport: () => Promise.resolve([...input.stored]),
        writeDerived: (value: { key: DisclosureValueKey; valueNumeric: string | null }) => {
          written.push(value);
          return Promise.resolve();
        },
      } as unknown as DisclosureValueStore,
      { forReport: () => Promise.resolve([]) } as unknown as DerivationInputStore,
      { targetAxes: () => input.targets } as unknown as AxisShapes,
    );
    await calculator.recompute({
      reportId: 'report',
      standard: 'vsme',
      touched: new Set(['GrossScope1GreenhouseGasEmissions']),
    });
    return written.map(({ key, valueNumeric }) => ({ dimensionKey: key.dimensionKey, valueNumeric }));
  };

  const stored = [
    figure('GrossScope1GreenhouseGasEmissions', '', '38.7'),
    figure('GrossLocationBasedScope2GreenhouseGasEmissions', '', '12'),
    figure('GrossScope1GreenhouseGasEmissions', 'BaselineYearMember', '41.8'),
    figure('GrossLocationBasedScope2GreenhouseGasEmissions', 'BaselineYearMember', '14.2'),
    // The target year's Scope 2 is not stated yet, so its total is no total.
    figure('GrossScope1GreenhouseGasEmissions', 'TargetYearMember', '31.4'),
  ];

  it('works the total out at the reporting year, the base year and the target year, each from its own year’s parts', async () => {
    expect(await run({ derivation: total(SCOPES.key), targets: new Map([[SCOPES.key, SCOPES]]), stored })).toEqual([
      { dimensionKey: '', valueNumeric: '50.7' },
      { dimensionKey: 'BaselineYearMember', valueNumeric: '56' },
      { dimensionKey: 'TargetYearMember', valueNumeric: null },
    ]);
  });

  it('works out the reporting year alone where the derivation names no axis, or names one nothing registers', async () => {
    const reportingYearOnly = [{ dimensionKey: '', valueNumeric: '50.7' }];
    expect(await run({ derivation: total(null), targets: new Map([[SCOPES.key, SCOPES]]), stored })).toEqual(
      reportingYearOnly,
    );
    expect(await run({ derivation: total(SCOPES.key), targets: new Map(), stored })).toEqual(reportingYearOnly);
  });
});
