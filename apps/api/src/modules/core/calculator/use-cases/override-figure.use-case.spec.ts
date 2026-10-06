import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { CalcOverrideInvalidError, UnknownCalcFigureError } from '../errors/calculator.errors';
import { FY2026_REPORT, FakeCalcReports, FakeCalculatedFigures } from '../testing/calculator.fakes';
import { OverrideFigure } from './override-figure.use-case';

describe('OverrideFigure', () => {
  const command = {
    reportId: FY2026_REPORT.reportId,
    elementKey: 'GrossScope1GreenhouseGasEmissions',
    valueNumeric: '1.75',
    explanation: 'Our accountant’s figure',
  };
  const build = () => {
    const figures = new FakeCalculatedFigures();
    return { figures, override: new OverrideFigure(new FakeCalcReports(), figures) };
  };

  it('hands a valid replacement to the disclosure store, for the standard the report is in', async () => {
    const { figures, override } = build();
    await override.execute(command);
    expect(figures.calls).toEqual([{ operation: 'override', command: { ...command, standard: 'vsme' } }]);
  });

  it.each([
    ['a figure the calculator does not produce', { ...command, elementKey: 'TotalGrossLocationBasedScope1AndScope2GHGEmissions' }, UnknownCalcFigureError],
    ['tonnes written with a comma', { ...command, valueNumeric: '1,75' }, CalcOverrideInvalidError],
    ['no reason', { ...command, explanation: ' ' }, CalcOverrideInvalidError],
    ['an unknown report', { ...command, reportId: 'elsewhere' }, ReportNotFoundError],
  ])('refuses %s, and writes nothing', async (_case, refused, error) => {
    const { figures, override } = build();
    await expect(override.execute(refused)).rejects.toBeInstanceOf(error);
    expect(figures.calls).toEqual([]);
  });
});
