import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { factorRefusal } from '../domain/calc-source-check';
import { NoCalcSourcesError, NoFactorSetError } from '../errors/calculator.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcRunStore } from '../interfaces/calc-run-store.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { CalcRun } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';
import { calcSourceRefusalError } from './calc-source-refusal-error';

/**
 * UC-33's first half — a run that retains every input and the factor set it used (task 38.1; P-11, FR-35, NFR-19).
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
 * **No results yet**: task 38.2 and 38.3 compute them and 38.4 writes them into B3, over the run this records.
 */
export class RecordCalcRun {
  constructor(
    private readonly reports: CalcReports,
    private readonly runs: CalcRunStore,
    private readonly factorSets: FactorSets,
  ) {}

  async execute(command: { readonly reportId: string }): Promise<{ readonly run: CalcRun; readonly factorSet: FactorSet }> {
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
    return { run, factorSet };
  }
}
