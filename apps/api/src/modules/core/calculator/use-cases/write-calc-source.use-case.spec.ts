import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TaxonomyRegistryService } from '@api/modules/platform/taxonomy/services/taxonomy-registry.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import {
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
    override: null,
  };

  const build = (options: { answered?: readonly number[]; factorSets?: FakeFactorSets } = {}) => {
    const sources = new FakeCalcSourceStore();
    const factorSets = options.factorSets ?? new FakeFactorSets();
    const reports = new FakeCalcReports([FY2026_REPORT], new Map([[FY2026_REPORT.reportId, options.answered ?? []]]));
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
    sources.lines.push({ ...line, reportId: 'report-2025', createdAt: new Date(0), updatedAt: new Date(0) });
    await expect(write.execute(line)).rejects.toBeInstanceOf(CalcSourceElsewhereError);
  });
});
