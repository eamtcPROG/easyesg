import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import {
  FY2026_REPORT,
  FakeCalcReports,
  FakeCalcRunStore,
  FakeCalcSiteNames,
  FakeCalcSourceStore,
  FakeFactorSets,
  SHIPPED_LIKE_SET,
} from '../testing/calculator.fakes';
import { ReadCalculator } from './read-calculator.use-case';

/**
 * S-09 as it opens (task 39.1): what the screen offers is what the write admits — the same set, the same site rows,
 * the same months — so each case here is one the write's own spec refuses or admits from the other side.
 */
describe('ReadCalculator', () => {
  const taxonomy = new TaxonomyRegistryService(seedConfigurationStore(readSeedEntries()));

  const build = (
    options: { answered?: readonly number[]; factorSets?: FakeFactorSets; report?: typeof FY2026_REPORT } = {},
  ) => {
    const report = options.report ?? FY2026_REPORT;
    const sources = new FakeCalcSourceStore();
    const reports = new FakeCalcReports([report], new Map([[report.reportId, options.answered ?? []]]));
    const names = new FakeCalcSiteNames(new Map([[report.reportId, new Map([[0, 'Str. Alba Iulia 21, Chișinău']])]]));
    const runs = new FakeCalcRunStore(sources, [report.reportId]);
    const precision = { places: () => ({ tCO2e: 2, MWh: 2 }) };
    const read = new ReadCalculator(
      reports,
      sources,
      options.factorSets ?? new FakeFactorSets(),
      taxonomy,
      names,
      runs,
      precision,
    );
    return { sources, runs, read };
  };

  it('offers the factor set the period resolves, the report’s site rows by name, and the period’s twelve months', async () => {
    const { read } = build({ answered: [2] });
    const view = await read.execute({ reportId: FY2026_REPORT.reportId });
    expect(view.factorSet).toBe(SHIPPED_LIKE_SET);
    // The snapshot's one site, and a site B1 holds beyond it — the write's `siteRows`, named where B1 names them.
    expect(view.sites).toEqual([
      { ordinal: 0, name: 'Str. Alba Iulia 21, Chișinău' },
      { ordinal: 2, name: null },
    ]);
    expect(view.months?.[0]).toBe('2026-01');
    expect(view.months).toHaveLength(12);
  });

  it('serves the lines with no factor set rather than refusing — the writes refuse, the record stays on screen', async () => {
    const { sources, read } = build({ factorSets: new FakeFactorSets(null) });
    sources.lines.push({
      reportId: FY2026_REPORT.reportId,
      sourceId: 'gas',
      siteOrdinal: 0,
      sourceKey: 'natural_gas',
      description: null,
      contents: { quantity: '500', unitCode: 'm3', notAvailableReason: null },
      monthlyQuantities: null,
      override: null,
      overriddenBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    const view = await read.execute({ reportId: FY2026_REPORT.reportId });
    expect(view.factorSet).toBeNull();
    expect(view.sources.map((line) => line.sourceId)).toEqual(['gas']);
  });

  it('offers no monthly form on a period that is not twelve whole calendar months', async () => {
    const catchUp = { ...FY2026_REPORT, periodStart: { ...FY2026_REPORT.periodStart, date: '2026-06-01' } };
    const view = await build({ report: catchUp }).read.execute({ reportId: FY2026_REPORT.reportId });
    expect(view.months).toBeNull();
  });

  it('offers no site to a report whose B1 records none', async () => {
    const bare = { ...FY2026_REPORT, snapshotSites: 0 };
    const view = await build({ report: bare }).read.execute({ reportId: FY2026_REPORT.reportId });
    expect(view.sites).toEqual([]);
  });

  it('answers not found for a report the tenant cannot see', async () => {
    await expect(build().read.execute({ reportId: 'elsewhere' })).rejects.toBeInstanceOf(ReportNotFoundError);
  });

  describe('what the lines come to, and the latest run (task 39.2)', () => {
    const gas = {
      reportId: FY2026_REPORT.reportId,
      sourceId: 'gas',
      siteOrdinal: 0,
      sourceKey: 'natural_gas',
      description: null,
      contents: { quantity: '500', unitCode: 'm3', notAvailableReason: null },
      monthlyQuantities: null,
      override: null,
      overriddenBy: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    it('serves the working figures against the set in force, before any run, and the places to round them to', async () => {
      const { sources, read } = build();
      sources.lines.push(gas);
      const view = await read.execute({ reportId: FY2026_REPORT.reportId });
      expect(view.working?.scopes[0]?.tonnesCo2e).toBe('0.9699123256');
      expect(view.latestRun).toBeNull();
      expect(view.precision).toEqual({ tCO2e: 2, MWh: 2 });
    });

    it('serves the latest run with the set it pinned, read back by the pin', async () => {
      const { sources, runs, read } = build();
      sources.lines.push(gas);
      const run = await runs.record({ reportId: FY2026_REPORT.reportId, factorSet: SHIPPED_LIKE_SET.pin });
      await runs.recordResults({
        runId: run?.id ?? '',
        results: [{ elementKey: 'GrossScope1GreenhouseGasEmissions', tonnesCo2e: '0.9699123256' }],
      });
      const view = await read.execute({ reportId: FY2026_REPORT.reportId });
      expect(view.latestRun).toMatchObject({ id: run?.id, pinned: SHIPPED_LIKE_SET });
      expect(view.latestRun?.results).toHaveLength(1);
    });

    it('serves no working figures where no set serves the period', async () => {
      const view = await build({ factorSets: new FakeFactorSets(null) }).read.execute({ reportId: FY2026_REPORT.reportId });
      expect(view.working).toBeNull();
    });
  });
});
