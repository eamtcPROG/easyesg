import type { CalculatedFigures } from '@api/modules/core/disclosure/interfaces/calculated-figures.interface';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { isCalcFigure } from '../domain/calc-figure';
import { UnknownCalcFigureError } from '../errors/calculator.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcRunStore } from '../interfaces/calc-run-store.interface';

/**
 * A B3 override removed, and the computed figure it superseded put back — S-09's *"reverting is one action"* (task
 * 38.4; UC-34).
 *
 * **The figure put back is the latest run's stored result**, which the override never touched: the calculator supplies
 * it and the disclosure store writes it. Removing an override that is not there changes nothing, so a replayed request
 * answers the same.
 */
export class RestoreFigure {
  constructor(
    private readonly reports: CalcReports,
    private readonly runs: CalcRunStore,
    private readonly figures: CalculatedFigures,
  ) {}

  async execute(command: { readonly reportId: string; readonly elementKey: string }): Promise<void> {
    if (!isCalcFigure(command.elementKey)) throw new UnknownCalcFigureError();
    if ((await this.reports.find({ reportId: command.reportId })) === null) throw new ReportNotFoundError();

    const computed = await this.runs.latestResult(command);
    await this.figures.restore({ ...command, standard: TAXONOMY_STANDARD.VSME, valueNumeric: computed ?? null });
  }
}
