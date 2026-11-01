import { UnknownCalcFigureError } from '../errors/calculator.errors';
import { FY2026_REPORT, FakeCalcReports, FakeCalculatedFigures } from '../testing/calculator.fakes';
import { ExplainFigure } from './explain-figure.use-case';

describe('ExplainFigure', () => {
  const explain = (explanation: string | null, elementKey = 'GrossLocationBasedScope2GreenhouseGasEmissions') => {
    const figures = new FakeCalculatedFigures();
    return {
      figures,
      done: new ExplainFigure(new FakeCalcReports(), figures).execute({ reportId: FY2026_REPORT.reportId, elementKey, explanation }),
    };
  };

  it('hands a note to the disclosure store', async () => {
    const { figures, done } = explain('Cahul is billed by its landlord');
    await done;
    expect(figures.calls).toEqual([
      {
        operation: 'explain',
        command: {
          reportId: FY2026_REPORT.reportId,
          elementKey: 'GrossLocationBasedScope2GreenhouseGasEmissions',
          explanation: 'Cahul is billed by its landlord',
        },
      },
    ]);
  });

  it('treats a blank note as removing it', async () => {
    const { figures, done } = explain('   ');
    await done;
    expect(figures.calls[0].command).toMatchObject({ explanation: null });
  });

  it('refuses a figure the calculator does not produce', async () => {
    await expect(explain('A note', 'Turnover').done).rejects.toBeInstanceOf(UnknownCalcFigureError);
  });
});
