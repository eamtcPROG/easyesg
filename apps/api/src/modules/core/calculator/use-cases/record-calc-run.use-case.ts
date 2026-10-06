import type { CalculatedFigures } from '@api/modules/core/disclosure/interfaces/calculated-figures.interface';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { factorRefusal } from '../domain/calc-source-check';
import { resultFigures, runResults } from '../domain/run-results';
import type { ScopeTotal } from '../domain/scope-total';
import { NoCalcSourcesError, NoFactorSetError } from '../errors/calculator.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcRunStore } from '../interfaces/calc-run-store.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { CalcRun } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';
import { calcSourceRefusalError } from './calc-source-refusal-error';

/**
 * UC-33 — a run that retains every input and the factor set it used, computes Scope 1 and location-based Scope 2, and
 * writes them into B3 (tasks 38.1, 38.4; P-11, FR-34, FR-35, NFR-19).
 *
 * **The set is the one in force for the report's period start** (§9.9), asked now: a recalculation after a correction
 * was published pins the correction, which is UX-44's offer, and a run never pins anything the period does not
 * resolve.
 *
 * **Recorded first, then checked, inside one transaction.** The store copies the lines as they stand when its statement
 * runs, so the use case checks *what was copied* rather than a list it read beforehand — a line added by a concurrent
 * request is checked too, and a refusal throws, which rolls the run back with the rest of the request (§6.2). A run
 * over no lines is refused for the same reason: zero is an answer someone might file.
 *
 * **Then computed from the copy, stored, and written** (task 38.4): the results are `runResults` over the retained
 * inputs and the pinned set — the same call a replay makes — stored with the run, and handed to the disclosure store,
 * which writes them as `calculated`, clears an earlier run's figure for a scope nothing measured, and recomputes B3's
 * total and intensity. All of it inside the request's transaction, so a run, its results and B3 land together or not
 * at all.
 */
export class RecordCalcRun {
  constructor(
    private readonly reports: CalcReports,
    private readonly runs: CalcRunStore,
    private readonly factorSets: FactorSets,
    private readonly figures: CalculatedFigures,
  ) {}

  async execute(command: { readonly reportId: string }): Promise<{
    readonly run: CalcRun;
    readonly factorSet: FactorSet;
    readonly scopes: readonly ScopeTotal[];
  }> {
    const report = await this.reports.find({ reportId: command.reportId });
    if (report === null) throw new ReportNotFoundError();

    const factorSet = this.factorSets.inForce({ country: report.countryCode, periodStart: report.periodStart.date });
    if (factorSet === null) throw new NoFactorSetError();

    const run = await this.runs.record({ reportId: command.reportId, factorSet: factorSet.pin });
    if (run === null) throw new ReportNotFoundError();
    if (run.inputs.length === 0) throw new NoCalcSourcesError();
    for (const input of run.inputs) {
      const refusal = factorRefusal({ sourceKey: input.sourceKey, contents: input.contents, factorSet });
      if (refusal !== null) throw calcSourceRefusalError(refusal);
    }

    const scopes = runResults({ inputs: run.inputs, factorSet });
    const figures = resultFigures(scopes);
    await this.runs.recordResults({
      reportId: command.reportId,
      runId: run.id,
      results: figures.map((figure) => ({ elementKey: figure.elementKey, tonnesCo2e: figure.valueNumeric })),
    });
    await this.figures.write({ reportId: command.reportId, standard: TAXONOMY_STANDARD.VSME, figures });
    return { run, factorSet, scopes };
  }
}
