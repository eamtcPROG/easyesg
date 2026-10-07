import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import {
  ReportNotFoundError,
  TaxonomyVersionUnavailableError,
} from '@api/modules/core/disclosure/errors/report.errors';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { CALC_SOURCE_REFUSAL, contentsRefusal, factorRefusal, monthsRefusal, overrideRefusal } from '../domain/calc-source-check';
import { monthsTotal } from '../domain/monthly-quantities';
import { periodMonths } from '../domain/period-months';
import { siteAxisElements, siteRows } from '../domain/site-rows';
import { CalcSourceElsewhereError, NoFactorSetError, UnknownCalcSiteError } from '../errors/calculator.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcSourceStore } from '../interfaces/calc-source-store.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { CalcSource, CalcSourceWrite } from '../models/calc-source.model';
import { calcSourceRefusalError } from './calc-source-refusal-error';

export type WriteCalcSourceCommand = CalcSourceWrite;

/**
 * UC-32 — record one invoice line, by source and by site, in the unit the invoice uses (task 38.1; FR-33, UX-40).
 *
 * **Every check is made before the write, against the report's own context**: the line's shape; its site, one of the
 * B1 rows the report discloses (§12.5.6's task-38.1 row); and its source and unit, against the factor set the report's
 * period resolves — the set a run will pin (§9.9). A line the factors cannot evaluate would sit in the working set
 * until a run refused it, which is a later and vaguer moment to learn of it.
 *
 * **A monthly line's quantity is computed here, never taken from the caller** (task 39.1; §12.5.6's task-39 row (1)):
 * the months are checked as the form, summed exactly, and the sum is what the line's contents and every later check
 * see — so the quantity a run copies is the twelve figures a reporter typed, added up. Whether the period offers the
 * form at all is the report's question, asked once the report is read.
 *
 * **The lock is not checked here.** FR-22 is the trigger's, which the repository turns into
 * `ReportNotEditableError` — `WriteDisclosureValues`' reasoning: a read-then-write check would lose the race the trigger
 * cannot.
 */
export class WriteCalcSource {
  constructor(
    private readonly reports: CalcReports,
    private readonly sources: CalcSourceStore,
    private readonly factorSets: FactorSets,
    private readonly taxonomy: TaxonomyRegistry,
  ) {}

  async execute(command: WriteCalcSourceCommand): Promise<CalcSource> {
    const months = monthsRefusal(command);
    if (months !== null) throw calcSourceRefusalError(months);
    const line: CalcSourceWrite =
      command.monthlyQuantities === null
        ? command
        : { ...command, contents: { ...command.contents, quantity: monthsTotal(command.monthlyQuantities) } };
    const contents = contentsRefusal(line.contents) ?? overrideRefusal(line);
    if (contents !== null) throw calcSourceRefusalError(contents);

    const report = await this.reports.find({ reportId: command.reportId });
    if (report === null) throw new ReportNotFoundError();
    if (
      line.monthlyQuantities !== null &&
      periodMonths({ start: report.periodStart.date, end: report.periodEnd.date }) === null
    ) {
      throw calcSourceRefusalError(CALC_SOURCE_REFUSAL.MONTHS);
    }

    const factorSet = this.factorSets.inForce({ country: report.countryCode, periodStart: report.periodStart.date });
    if (factorSet === null) throw new NoFactorSetError();
    const factors = factorRefusal({ sourceKey: line.sourceKey, contents: line.contents, factorSet });
    if (factors !== null) throw calcSourceRefusalError(factors);

    const registered = this.taxonomy.taxonomy({ standard: TAXONOMY_STANDARD.VSME, version: report.taxonomyVersion });
    if (registered === null) throw new TaxonomyVersionUnavailableError();
    const answered = await this.reports.answeredOrdinals({
      reportId: command.reportId,
      elementKeys: siteAxisElements(registered),
    });
    if (!siteRows({ answered, snapshotSites: report.snapshotSites }).has(command.siteOrdinal)) {
      throw new UnknownCalcSiteError();
    }

    const written = await this.sources.write(line);
    if (written === null) throw new CalcSourceElsewhereError();
    return written;
  }
}
