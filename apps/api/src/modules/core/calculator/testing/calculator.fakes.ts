import type { CalculatedFigures } from '@api/modules/core/disclosure/interfaces/calculated-figures.interface';
import type { CalcReport, CalcReports } from '../interfaces/calc-report.interface';
import type { CalcRunStore } from '../interfaces/calc-run-store.interface';
import type { CalcSiteNames } from '../interfaces/calc-site-names.interface';
import type { CalcSourceStore } from '../interfaces/calc-source-store.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { CalcResult, CalcRun, LatestCalcRun, StoredCalcRun } from '../models/calc-run.model';
import type { CalcSource, CalcSourceKey, CalcSourceWrite } from '../models/calc-source.model';
import type { FactorSet, FactorSetPin } from '../models/factor-set.model';

/**
 * The calculator's ports as in-memory doubles, shared by its use-case specs (`apps/api/CLAUDE.md`: `testing/` holds a
 * double more than one spec reads). **The run store copies from the line store**, as the real one copies in the
 * database, so a spec can put a line in, record a run, edit the line and see the run keep what it read.
 */

export const FY2026_REPORT: CalcReport = {
  reportId: 'report-2026',
  periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
  periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
  taxonomyVersion: '2026-05-01',
  countryCode: 'MD',
  snapshotSites: 1,
};

export const SHIPPED_LIKE_SET: FactorSet = {
  pin: { country: 'md', revision: 4 },
  label: '2026.1',
  sources: new Map([
    [
      'natural_gas',
      {
        key: 'natural_gas',
        ghgScope: 'scope_1',
        emissionFactor: '0.202544',
        units: new Map([['m3', '0.0095773']]),
        reference: 'IPCC 2006',
      },
    ],
    [
      'electricity_grid',
      {
        key: 'electricity_grid',
        ghgScope: 'scope_2_location_based',
        emissionFactor: '0.594645',
        units: new Map([['kWh', '0.001']]),
        reference: 'JRC 2024',
      },
    ],
  ]),
};

export class FakeCalcReports implements CalcReports {
  constructor(
    private readonly reports: readonly CalcReport[] = [FY2026_REPORT],
    /** Ordinals any site-axis element is answered at, per report. */
    private readonly answered: ReadonlyMap<string, readonly number[]> = new Map(),
  ) {}

  find(query: { readonly reportId: string }): Promise<CalcReport | null> {
    return Promise.resolve(this.reports.find((report) => report.reportId === query.reportId) ?? null);
  }

  answeredOrdinals(query: { readonly reportId: string }): Promise<number[]> {
    return Promise.resolve([...(this.answered.get(query.reportId) ?? [])]);
  }
}

/** `CALC_SITE_NAMES` as a fixed answer per report — the names the wizard would serve. */
export class FakeCalcSiteNames implements CalcSiteNames {
  constructor(private readonly byReport: ReadonlyMap<string, ReadonlyMap<number, string>> = new Map()) {}

  names(query: { readonly reportId: string }): Promise<ReadonlyMap<number, string>> {
    return Promise.resolve(this.byReport.get(query.reportId) ?? new Map());
  }
}

export class FakeFactorSets implements FactorSets {
  /** What each call was asked, so a spec can hold the use case to the period's start and the organization's country. */
  readonly asked: { country: string; periodStart: string }[] = [];

  constructor(private readonly set: FactorSet | null = SHIPPED_LIKE_SET) {}

  inForce(query: { readonly country: string; readonly periodStart: string }): FactorSet | null {
    this.asked.push({ country: query.country, periodStart: query.periodStart });
    return this.set;
  }

  pinned(pin: FactorSetPin): Promise<FactorSet | null> {
    return Promise.resolve(
      this.set !== null && this.set.pin.country === pin.country && this.set.pin.revision === pin.revision ? this.set : null,
    );
  }
}

export class FakeCalcSourceStore implements CalcSourceStore {
  readonly lines: CalcSource[] = [];

  forReport(query: { readonly reportId: string }): Promise<CalcSource[]> {
    return Promise.resolve(this.lines.filter((line) => line.reportId === query.reportId));
  }

  write(line: CalcSourceWrite): Promise<CalcSource | null> {
    const at = this.lines.findIndex((existing) => existing.sourceId === line.sourceId);
    if (at >= 0 && this.lines[at].reportId !== line.reportId) return Promise.resolve(null);
    // The person who overrode a line is the table's trigger's, taken from the request's binding no use case sees.
    const stored: CalcSource = { ...line, overriddenBy: null, createdAt: new Date(0), updatedAt: new Date(0) };
    if (at >= 0) this.lines[at] = stored;
    else this.lines.push(stored);
    return Promise.resolve(stored);
  }

  remove(key: CalcSourceKey): Promise<boolean> {
    const at = this.lines.findIndex((line) => line.reportId === key.reportId && line.sourceId === key.sourceId);
    if (at < 0) return Promise.resolve(false);
    this.lines.splice(at, 1);
    return Promise.resolve(true);
  }
}

export class FakeCalcRunStore implements CalcRunStore {
  readonly runs: CalcRun[] = [];
  readonly results = new Map<string, readonly CalcResult[]>();

  constructor(
    private readonly lines: FakeCalcSourceStore,
    private readonly reports: readonly string[] = [FY2026_REPORT.reportId],
  ) {}

  record(command: { readonly reportId: string; readonly factorSet: FactorSetPin }): Promise<CalcRun | null> {
    if (!this.reports.includes(command.reportId)) return Promise.resolve(null);
    const run: CalcRun = {
      id: `run-${this.runs.length + 1}`,
      reportId: command.reportId,
      factorSet: command.factorSet,
      recordedAt: new Date(0),
      recordedBy: null,
      inputs: this.lines.lines
        .filter((line) => line.reportId === command.reportId)
        .map((line) => ({
          sourceId: line.sourceId,
          siteOrdinal: line.siteOrdinal,
          sourceKey: line.sourceKey,
          description: line.description,
          contents: { ...line.contents },
          override: line.override,
          overriddenBy: line.overriddenBy,
        })),
    };
    this.runs.push(run);
    return Promise.resolve(run);
  }

  recordResults(command: { readonly runId: string; readonly results: readonly CalcResult[] }): Promise<void> {
    this.results.set(command.runId, command.results);
    return Promise.resolve();
  }

  find(query: { readonly reportId: string; readonly runId: string }): Promise<StoredCalcRun | null> {
    const run = this.runs.find((each) => each.id === query.runId && each.reportId === query.reportId);
    return Promise.resolve(run === undefined ? null : { ...run, results: this.results.get(run.id) ?? [] });
  }

  latestResult(query: { readonly reportId: string; readonly elementKey: string }): Promise<string | null | undefined> {
    const latest = [...this.runs].reverse().find((run) => run.reportId === query.reportId && this.results.has(run.id));
    const result = latest === undefined ? undefined : this.results.get(latest.id)?.find((each) => each.elementKey === query.elementKey);
    return Promise.resolve(result === undefined ? undefined : result.tonnesCo2e);
  }

  latest(query: { readonly reportId: string }): Promise<LatestCalcRun | null> {
    const run = [...this.runs].reverse().find((each) => each.reportId === query.reportId);
    return Promise.resolve(
      run === undefined
        ? null
        : { id: run.id, factorSet: run.factorSet, recordedAt: run.recordedAt, results: this.results.get(run.id) ?? [] },
    );
  }
}

/** `CALCULATED_FIGURES` as a record of every call handed to it — what the calculator sent into B3. */
export class FakeCalculatedFigures implements CalculatedFigures {
  readonly written: { reportId: string; figures: readonly { elementKey: string; valueNumeric: string | null }[] }[] = [];
  readonly calls: { readonly operation: string; readonly command: unknown }[] = [];

  write(command: Parameters<CalculatedFigures['write']>[0]): Promise<void> {
    this.written.push({ reportId: command.reportId, figures: command.figures });
    return Promise.resolve();
  }

  override(command: Parameters<CalculatedFigures['override']>[0]): Promise<void> {
    this.calls.push({ operation: 'override', command });
    return Promise.resolve();
  }

  restore(command: Parameters<CalculatedFigures['restore']>[0]): Promise<void> {
    this.calls.push({ operation: 'restore', command });
    return Promise.resolve();
  }

  explain(command: Parameters<CalculatedFigures['explain']>[0]): Promise<void> {
    this.calls.push({ operation: 'explain', command });
    return Promise.resolve();
  }
}
