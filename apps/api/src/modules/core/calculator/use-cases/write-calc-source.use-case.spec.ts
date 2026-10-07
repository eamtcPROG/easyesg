import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import {
  CalcMonthsInvalidError,
  CalcSourceContentsError,
  CalcSourceElsewhereError,
  CalcUnitNotAdmittedError,
  NoFactorSetError,
  UnknownCalcSiteError,
  UnknownCalcSourceError,
} from '../errors/calculator.errors';
import { FY2026_REPORT, FakeCalcReports, FakeCalcSourceStore, FakeFactorSets } from '../testing/calculator.fakes';
import { WriteCalcSource, type WriteCalcSourceCommand } from './write-calc-source.use-case';

describe('WriteCalcSource', () => {
  const taxonomy = new TaxonomyRegistryService(seedConfigurationStore(readSeedEntries()));

  const line: WriteCalcSourceCommand = {
    reportId: FY2026_REPORT.reportId,
    sourceId: 'line-1',
    siteOrdinal: 0,
    sourceKey: 'natural_gas',
    description: 'Oven',
    contents: { quantity: '500', unitCode: 'm3', notAvailableReason: null },
    monthlyQuantities: null,
    override: null,
  };

  const build = (
    options: { answered?: readonly number[]; factorSets?: FakeFactorSets; report?: typeof FY2026_REPORT } = {},
  ) => {
    const sources = new FakeCalcSourceStore();
    const factorSets = options.factorSets ?? new FakeFactorSets();
    const report = options.report ?? FY2026_REPORT;
    const reports = new FakeCalcReports([report], new Map([[report.reportId, options.answered ?? []]]));
    return { sources, factorSets, write: new WriteCalcSource(reports, sources, factorSets, taxonomy) };
  };

  it('stores a line at one of the report’s sites, in a unit its source admits', async () => {
    const { sources, write } = build();
    await expect(write.execute(line)).resolves.toMatchObject({ sourceId: 'line-1', siteOrdinal: 0 });
    expect(sources.lines).toHaveLength(1);
  });

  it('asks the factor set of the organization’s country, for the period’s start', async () => {
    const { factorSets, write } = build();
    await write.execute(line);
    expect(factorSets.asked).toEqual([{ country: 'MD', periodStart: '2026-01-01' }]);
  });

  it('admits a site B1 holds beyond the snapshot', async () => {
    const { write } = build({ answered: [2] });
    await expect(write.execute({ ...line, siteOrdinal: 2 })).resolves.toMatchObject({ siteOrdinal: 2 });
  });

  it.each([
    ['a malformed line', { ...line, contents: { ...line.contents, unitCode: null } }, CalcSourceContentsError],
    ['an unknown report', { ...line, reportId: 'elsewhere' }, ReportNotFoundError],
    ['a source the set does not cover', { ...line, sourceKey: 'district_heating' }, UnknownCalcSourceError],
    ['a unit the source does not admit', { ...line, contents: { ...line.contents, unitCode: 'Gcal' } }, CalcUnitNotAdmittedError],
    ['a site the report does not list', { ...line, siteOrdinal: 1 }, UnknownCalcSiteError],
  ])('refuses %s, and stores nothing', async (_case, command, error) => {
    const { sources, write } = build();
    await expect(write.execute(command)).rejects.toBeInstanceOf(error);
    expect(sources.lines).toHaveLength(0);
  });

  it('refuses a line when no factor set serves the period', async () => {
    const { write } = build({ factorSets: new FakeFactorSets(null) });
    await expect(write.execute(line)).rejects.toBeInstanceOf(NoFactorSetError);
  });

  it('refuses an id another report’s line already holds', async () => {
    const { sources, write } = build();
    sources.lines.push({ ...line, reportId: 'report-2025', overriddenBy: null, createdAt: new Date(0), updatedAt: new Date(0) });
    await expect(write.execute(line)).rejects.toBeInstanceOf(CalcSourceElsewhereError);
  });

  describe('the monthly form (task 39.1)', () => {
    // Twelve months of gas bills, March left empty: flagged on screen, not refused here.
    const months = ['40', '45', null, '38', '30', '22', '18', '17', '21', '33', '41', '48.5'];
    const monthly: WriteCalcSourceCommand = {
      ...line,
      contents: { quantity: null, unitCode: 'm3', notAvailableReason: null },
      monthlyQuantities: months,
    };

    it('stores the months, and their exact sum as the quantity a run will copy', async () => {
      const { sources, write } = build();
      await expect(write.execute(monthly)).resolves.toMatchObject({
        contents: { quantity: '353.5', unitCode: 'm3' },
        monthlyQuantities: months,
      });
      expect(sources.lines[0].contents.quantity).toBe('353.5');
    });

    it('takes the quantity from the months, never from the caller', async () => {
      const { sources, write } = build();
      await expect(write.execute({ ...monthly, contents: { ...monthly.contents, quantity: '999' } })).rejects.toBeInstanceOf(
        CalcMonthsInvalidError,
      );
      expect(sources.lines).toHaveLength(0);
    });

    it('refuses months on a period that is not twelve whole calendar months, and stores nothing', async () => {
      const catchUp = { ...FY2026_REPORT, periodStart: { ...FY2026_REPORT.periodStart, date: '2026-06-01' } };
      const { sources, write } = build({ report: catchUp });
      await expect(write.execute(monthly)).rejects.toBeInstanceOf(CalcMonthsInvalidError);
      expect(sources.lines).toHaveLength(0);
      // The same period still takes the line as one figure.
      await expect(write.execute(line)).resolves.toMatchObject({ monthlyQuantities: null });
    });

    it('checks the summed quantity against the factor set like any other figure', async () => {
      const { write } = build();
      await expect(
        write.execute({ ...monthly, contents: { ...monthly.contents, unitCode: 'Gcal' } }),
      ).rejects.toBeInstanceOf(CalcUnitNotAdmittedError);
    });
  });
});
