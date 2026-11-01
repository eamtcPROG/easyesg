import { isDecimalString } from '@api/contracts/types/decimal';
import type { CalculatedFigures } from '@api/modules/core/disclosure/interfaces/calculated-figures.interface';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { isCalcFigure } from '../domain/calc-figure';
import { CalcOverrideInvalidError, UnknownCalcFigureError } from '../errors/calculator.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';

/**
 * UC-34's *replace* for a whole B3 figure — the accountant's Scope 1 in place of the calculator's (task 38.4; FR-36,
 * UX-43).
 *
 * **Checked here, written by the disclosure store.** The figure must be one the calculator produces, the replacement
 * tonnes written as a decimal, and the reason given; whether there is a computed figure under it to supersede is the
 * store's question, asked of the row that stands. The superseded figure is the latest run's stored result, kept.
 */
export class OverrideFigure {
  constructor(
    private readonly reports: CalcReports,
    private readonly figures: CalculatedFigures,
  ) {}

  async execute(command: {
    readonly reportId: string;
    readonly elementKey: string;
    readonly valueNumeric: string;
    readonly explanation: string;
  }): Promise<void> {
    if (!isCalcFigure(command.elementKey)) throw new UnknownCalcFigureError();
    if (!isDecimalString(command.valueNumeric) || command.explanation.trim() === '') throw new CalcOverrideInvalidError();
    if ((await this.reports.find({ reportId: command.reportId })) === null) throw new ReportNotFoundError();

    await this.figures.override({ ...command, standard: TAXONOMY_STANDARD.VSME });
  }
}
