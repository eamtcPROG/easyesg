import { UnknownCalcFigureError } from '../errors/calculator.errors';
import type { CalcSource } from '../models/calc-source.model';
import {
  FY2026_REPORT,
  FakeCalcReports,
  FakeCalcRunStore,
  FakeCalcSourceStore,
  FakeCalculatedFigures,
  FakeFactorSets,
} from '../testing/calculator.fakes';
import { RecordCalcRun } from './record-calc-run.use-case';
import { RestoreFigure } from './restore-figure.use-case';

describe('RestoreFigure', () => {
  const gas: CalcSource = {
    reportId: FY2026_REPORT.reportId,
    sourceId: 'gas',
    siteOrdinal: 0,
    sourceKey: 'natural_gas',
    description: null,
    contents: { quantity: '500', unitCode: 'm3', notAvailableReason: null },
    override: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  it('puts back what the latest run computed for the figure', async () => {
    const sources = new FakeCalcSourceStore();
    sources.lines.push(gas);
    const runs = new FakeCalcRunStore(sources);
    const figures = new FakeCalculatedFigures();
    await new RecordCalcRun(new FakeCalcReports(), runs, new FakeFactorSets(), figures).execute({ reportId: FY2026_REPORT.reportId });

    await new RestoreFigure(new FakeCalcReports(), runs, figures).execute({
      reportId: FY2026_REPORT.reportId,
      elementKey: 'GrossScope1GreenhouseGasEmissions',
    });
    expect(figures.calls).toEqual([
      {
        operation: 'restore',
        command: {
          reportId: FY2026_REPORT.reportId,
          elementKey: 'GrossScope1GreenhouseGasEmissions',
          standard: 'vsme',
          valueNumeric: '0.9699123256',
        },
      },
    ]);
  });

  it('refuses a figure the calculator does not produce', async () => {
    const runs = new FakeCalcRunStore(new FakeCalcSourceStore());
    await expect(
      new RestoreFigure(new FakeCalcReports(), runs, new FakeCalculatedFigures()).execute({
        reportId: FY2026_REPORT.reportId,
        elementKey: 'Turnover',
      }),
    ).rejects.toBeInstanceOf(UnknownCalcFigureError);
  });
});
