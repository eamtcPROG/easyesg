import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import {
  FY2026_REPORT,
  FakeCalcReports,
  FakeCalcRunStore,
  FakeCalcSourceStore,
  FakeFactorSets,
  SHIPPED_LIKE_SET,
} from '../testing/calculator.fakes';
import { ReadCalcFigures } from './read-calc-figures.use-case';

describe('ReadCalcFigures (task 39.3)', () => {
  const build = () => {
    const runs = new FakeCalcRunStore(new FakeCalcSourceStore());
    return { runs, read: new ReadCalcFigures(new FakeCalcReports(), runs, new FakeFactorSets()) };
  };

  it('answers no run before the first, so an override has nothing to supersede', async () => {
    await expect(build().read.execute({ reportId: FY2026_REPORT.reportId })).resolves.toEqual({ latestRun: null });
  });

  it('answers the latest run’s stored figures with the set it pinned — what an override supersedes', async () => {
    const { runs, read } = build();
    const run = await runs.record({ reportId: FY2026_REPORT.reportId, factorSet: SHIPPED_LIKE_SET.pin });
    await runs.recordResults({
      runId: run?.id ?? '',
      results: [{ elementKey: 'GrossScope1GreenhouseGasEmissions', tonnesCo2e: '0.89' }],
    });
    const { latestRun } = await read.execute({ reportId: FY2026_REPORT.reportId });
    expect(latestRun).toMatchObject({ id: run?.id, pinned: SHIPPED_LIKE_SET });
    expect(latestRun?.results).toEqual([{ elementKey: 'GrossScope1GreenhouseGasEmissions', tonnesCo2e: '0.89' }]);
  });

  it('answers not found for a report the tenant cannot see', async () => {
    await expect(build().read.execute({ reportId: 'elsewhere' })).rejects.toBeInstanceOf(ReportNotFoundError);
  });
});
