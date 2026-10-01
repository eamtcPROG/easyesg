import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import {
  CalcUnitNotAdmittedError,
  NoCalcSourcesError,
  NoFactorSetError,
  UnknownCalcSourceError,
} from '../errors/calculator.errors';
import type { CalcSource } from '../models/calc-source.model';
import {
  FY2026_REPORT,
  FakeCalcReports,
  FakeCalcRunStore,
  FakeCalcSourceStore,
  FakeFactorSets,
  SHIPPED_LIKE_SET,
} from '../testing/calculator.fakes';
import { RecordCalcRun } from './record-calc-run.use-case';

describe('RecordCalcRun', () => {
  const line = (sourceId: string, overrides: Partial<CalcSource> = {}): CalcSource => ({
    reportId: FY2026_REPORT.reportId,
    sourceId,
    siteOrdinal: 0,
    sourceKey: 'natural_gas',
    description: null,
    contents: { quantity: '500', unitCode: 'm3', notAvailableReason: null },
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  });

  const build = (factorSets = new FakeFactorSets()) => {
    const sources = new FakeCalcSourceStore();
    const runs = new FakeCalcRunStore(sources);
    return { sources, runs, record: new RecordCalcRun(new FakeCalcReports(), runs, factorSets) };
  };

  it('retains every line and pins the set the period resolves', async () => {
    const { sources, record } = build();
    sources.lines.push(line('gas'), line('grid', { sourceKey: 'electricity_grid', contents: { quantity: '17000', unitCode: 'kWh', notAvailableReason: null } }));

    const { run, factorSet } = await record.execute({ reportId: FY2026_REPORT.reportId });

    expect(run.factorSet).toEqual(SHIPPED_LIKE_SET.pin);
    expect(factorSet.label).toBe('2026.1');
    expect(run.inputs.map((input) => input.sourceId)).toEqual(['gas', 'grid']);
  });

  it('retains an explained line on its source alone', async () => {
    const { sources, record } = build();
    sources.lines.push(line('landlord', { sourceKey: 'electricity_grid', contents: { quantity: null, unitCode: null, notAvailableReason: 'Billed by the landlord' } }));
    await expect(record.execute({ reportId: FY2026_REPORT.reportId })).resolves.toMatchObject({
      run: { inputs: [expect.objectContaining({ sourceId: 'landlord' })] },
    });
  });

  it('keeps what it read when the line is edited afterwards', async () => {
    const { sources, record } = build();
    sources.lines.push(line('gas'));
    const { run } = await record.execute({ reportId: FY2026_REPORT.reportId });

    await sources.write({ ...line('gas'), contents: { quantity: '640', unitCode: 'm3', notAvailableReason: null } });
    expect(run.inputs[0].contents.quantity).toBe('500');
  });

  it('refuses a run over no lines', async () => {
    const { record } = build();
    await expect(record.execute({ reportId: FY2026_REPORT.reportId })).rejects.toBeInstanceOf(NoCalcSourcesError);
  });

  it('refuses where no set serves the period, or the report is not there', async () => {
    await expect(build(new FakeFactorSets(null)).record.execute({ reportId: FY2026_REPORT.reportId })).rejects.toBeInstanceOf(
      NoFactorSetError,
    );
    await expect(build().record.execute({ reportId: 'elsewhere' })).rejects.toBeInstanceOf(ReportNotFoundError);
  });

  it.each([
    ['a source the pinned set no longer covers', { sourceKey: 'heating_oil' }, UnknownCalcSourceError],
    ['a unit it no longer admits', { contents: { quantity: '5', unitCode: 'Gcal', notAvailableReason: null } }, CalcUnitNotAdmittedError],
  ])('refuses a copied line with %s', async (_case, overrides, error) => {
    const { sources, record } = build();
    sources.lines.push(line('gas'), line('stale', overrides));
    await expect(record.execute({ reportId: FY2026_REPORT.reportId })).rejects.toBeInstanceOf(error);
  });
});
