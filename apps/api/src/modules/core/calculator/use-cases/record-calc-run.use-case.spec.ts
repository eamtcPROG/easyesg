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
  FakeCalculatedFigures,
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
    monthlyQuantities: null,
    override: null,
    overriddenBy: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  });

  const build = (factorSets = new FakeFactorSets()) => {
    const sources = new FakeCalcSourceStore();
    const runs = new FakeCalcRunStore(sources);
    const figures = new FakeCalculatedFigures();
    return { sources, runs, figures, record: new RecordCalcRun(new FakeCalcReports(), runs, factorSets, figures) };
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

  describe('its results (task 38.4)', () => {
    // 500 m³ × 0.0095773 × 0.202544 and 17 000 kWh × 0.001 × 0.594645, as Python's decimal computes them.
    const lines = () => [
      line('gas'),
      line('grid', { sourceKey: 'electricity_grid', contents: { quantity: '17000', unitCode: 'kWh', notAvailableReason: null } }),
    ];

    it('computes both scopes from what it copied, stores them with the run, and writes them into B3', async () => {
      const { sources, runs, figures, record } = build();
      sources.lines.push(...lines());

      const { run, scopes } = await record.execute({ reportId: FY2026_REPORT.reportId });

      const expected = [
        { elementKey: 'GrossScope1GreenhouseGasEmissions', valueNumeric: '0.9699123256' },
        { elementKey: 'GrossLocationBasedScope2GreenhouseGasEmissions', valueNumeric: '10.108965' },
      ];
      expect(scopes.map((scope) => scope.tonnesCo2e)).toEqual(['0.9699123256', '10.108965']);
      expect(runs.results.get(run.id)).toEqual(
        expected.map((figure) => ({ elementKey: figure.elementKey, tonnesCo2e: figure.valueNumeric })),
      );
      expect(figures.written).toEqual([{ reportId: FY2026_REPORT.reportId, figures: expected }]);
    });

    it('hands a scope nothing measured to B3 as no figure, never as zero', async () => {
      const { sources, figures, record } = build();
      sources.lines.push(line('gas'));

      await record.execute({ reportId: FY2026_REPORT.reportId });

      expect(figures.written[0].figures).toEqual([
        { elementKey: 'GrossScope1GreenhouseGasEmissions', valueNumeric: '0.9699123256' },
        { elementKey: 'GrossLocationBasedScope2GreenhouseGasEmissions', valueNumeric: null },
      ]);
    });

    it('writes nothing into B3 when the run is refused', async () => {
      const { figures, record } = build();
      await expect(record.execute({ reportId: FY2026_REPORT.reportId })).rejects.toBeInstanceOf(NoCalcSourcesError);
      expect(figures.written).toEqual([]);
    });
  });
});
