import { CalcRunNotFoundError } from '../errors/calculator.errors';
import type { CalcSource } from '../models/calc-source.model';
import type { FactorSet } from '../models/factor-set.model';
import {
  FY2026_REPORT,
  FakeCalcReports,
  FakeCalcRunStore,
  FakeCalcSourceStore,
  FakeCalculatedFigures,
  FakeFactorSets,
  SHIPPED_LIKE_SET,
} from '../testing/calculator.fakes';
import { ReadCalcRun } from './read-calc-run.use-case';
import { RecordCalcRun } from './record-calc-run.use-case';

/**
 * A recorded run read back and computed again (task 38.4; NFR-19). The pinned set is what the replay reads — the
 * factor-set double answers `pinned` only for its own pin — so a run reproduces against the factors it was recorded
 * under, whatever is in force since.
 */
describe('ReadCalcRun', () => {
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

  const recorded = async (set: FactorSet = SHIPPED_LIKE_SET) => {
    const sources = new FakeCalcSourceStore();
    sources.lines.push(gas);
    const runs = new FakeCalcRunStore(sources);
    const factorSets = new FakeFactorSets(set);
    const { run } = await new RecordCalcRun(new FakeCalcReports(), runs, factorSets, new FakeCalculatedFigures()).execute({
      reportId: FY2026_REPORT.reportId,
    });
    return { run, runs, factorSets };
  };

  it('reproduces what the run stored, computed again from what it retained', async () => {
    const { run, runs, factorSets } = await recorded();
    const replay = await new ReadCalcRun(runs, factorSets).execute({ reportId: FY2026_REPORT.reportId, runId: run.id });

    expect(replay.reproduces).toBe(true);
    expect(replay.factorSet.label).toBe('2026.1');
    expect(replay.scopes[0]).toMatchObject({ tonnesCo2e: '0.9699123256' });
  });

  it('says it does not reproduce when the stored figure is not what the inputs give', async () => {
    const { run, runs, factorSets } = await recorded();
    runs.results.set(run.id, [
      { elementKey: 'GrossScope1GreenhouseGasEmissions', tonnesCo2e: '0.97' },
      { elementKey: 'GrossLocationBasedScope2GreenhouseGasEmissions', tonnesCo2e: null },
    ]);

    const replay = await new ReadCalcRun(runs, factorSets).execute({ reportId: FY2026_REPORT.reportId, runId: run.id });
    expect(replay.reproduces).toBe(false);
  });

  it('reads trailing zeros a numeric hands back as the same figure', async () => {
    const { run, runs, factorSets } = await recorded();
    runs.results.set(run.id, [
      { elementKey: 'GrossScope1GreenhouseGasEmissions', tonnesCo2e: '0.969912325600' },
      { elementKey: 'GrossLocationBasedScope2GreenhouseGasEmissions', tonnesCo2e: null },
    ]);

    const replay = await new ReadCalcRun(runs, factorSets).execute({ reportId: FY2026_REPORT.reportId, runId: run.id });
    expect(replay.reproduces).toBe(true);
  });

  it('refuses rather than answers when the pin names no readable set', async () => {
    const { run, runs } = await recorded();
    await expect(
      new ReadCalcRun(runs, new FakeFactorSets(null)).execute({ reportId: FY2026_REPORT.reportId, runId: run.id }),
    ).rejects.toThrow(/pinned to md\/4/);
  });

  it('answers not found for a run of another report', async () => {
    const { run, runs, factorSets } = await recorded();
    await expect(new ReadCalcRun(runs, factorSets).execute({ reportId: 'elsewhere', runId: run.id })).rejects.toBeInstanceOf(
      CalcRunNotFoundError,
    );
  });
});
