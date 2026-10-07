import type { PresentationPrecision } from '@api/contracts/presentation-precision.port';
import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import {
  ReportNotFoundError,
  TaxonomyVersionUnavailableError,
} from '@api/modules/core/disclosure/errors/report.errors';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { periodMonths } from '../domain/period-months';
import { siteAxisElements, siteRows } from '../domain/site-rows';
import { workingResults } from '../domain/working-results';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcRunStore } from '../interfaces/calc-run-store.interface';
import type { CalcSiteNames } from '../interfaces/calc-site-names.interface';
import type { CalcSourceStore } from '../interfaces/calc-source-store.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { CalculatorView } from '../models/calculator-view.model';

/**
 * S-09 as it opens — UC-32's screen (task 39.1; FR-33, UX-40, UX-41).
 *
 * **Everything a line may say, beside the lines**: the sources and units of the set the period resolves, the sites a
 * line may belong to, and the months the monthly form stands for. The writes check against the same three — the set
 * by `FACTOR_SETS.inForce`, the sites by `siteRows`, the months by `periodMonths` — so what the screen offers is what
 * the write admits, by sharing the functions rather than by keeping two lists in step.
 *
 * **No factor set is an answer, not a refusal**: the screen still shows the lines and says why none can be written,
 * where refusing the read would hide the record UX-41 keeps on screen. The writes refuse (`NoFactorSetError`).
 *
 * **Since task 39.2, what the lines come to as well** — the working figures against the set in force, which a run would
 * store — **and the latest run**, with the set it pinned read back by that pin, so the screen can show UX-44's *now* and
 * *would be* when the two sets differ; and the places every surface rounds a figure to.
 */
export class ReadCalculator {
  constructor(
    private readonly reports: CalcReports,
    private readonly sources: CalcSourceStore,
    private readonly factorSets: FactorSets,
    private readonly taxonomy: TaxonomyRegistry,
    private readonly siteNames: CalcSiteNames,
    private readonly runs: CalcRunStore,
    private readonly precision: PresentationPrecision,
  ) {}

  async execute(query: { readonly reportId: string }): Promise<CalculatorView> {
    const report = await this.reports.find({ reportId: query.reportId });
    if (report === null) throw new ReportNotFoundError();

    const registered = this.taxonomy.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version: report.taxonomyVersion });
    if (registered === null) throw new TaxonomyVersionUnavailableError();

    // In turn rather than together: every read is on the request's one transaction, whose connection runs one
    // statement at a time whatever the caller asks for.
    const answered = await this.reports.answeredOrdinals({
      reportId: query.reportId,
      elementKeys: siteAxisElements(registered),
    });
    const names = await this.siteNames.names({ reportId: query.reportId });
    const sources = await this.sources.forReport({ reportId: query.reportId });
    const latest = await this.runs.latest({ reportId: query.reportId });
    const factorSet = this.factorSets.inForce({ country: report.countryCode, periodStart: report.periodStart.date });
    const sites = [...siteRows({ answered, snapshotSites: report.snapshotSites })]
      .sort((a, b) => a - b)
      .map((ordinal) => ({ ordinal, name: names.get(ordinal) ?? null }));

    return {
      factorSet,
      sites,
      months: periodMonths({ start: report.periodStart.date, end: report.periodEnd.date }),
      sources,
      working: factorSet === null ? null : workingResults({ sources, factorSet }),
      latestRun: latest === null ? null : { ...latest, pinned: await this.factorSets.pinned(latest.factorSet) },
      precision: this.precision.places(),
    };
  }
}
