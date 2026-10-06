import type { CalculatedFigures } from '@api/modules/core/disclosure/interfaces/calculated-figures.interface';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { isCalcFigure } from '../domain/calc-figure';
import { UnknownCalcFigureError } from '../errors/calculator.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';

/**
 * UC-34's *explain* for a B3 figure the calculator computed — a note that stays beside it (task 38.4; FR-36).
 *
 * **A blank note is no note**: an explanation of whitespace explains nothing, so it removes the one there is rather
 * than storing an empty string a reader would meet as a blank line.
 */
export class ExplainFigure {
  constructor(
    private readonly reports: CalcReports,
    private readonly figures: CalculatedFigures,
  ) {}

  async execute(command: {
    readonly reportId: string;
    readonly elementKey: string;
    readonly explanation: string | null;
  }): Promise<void> {
    if (!isCalcFigure(command.elementKey)) throw new UnknownCalcFigureError();
    if ((await this.reports.find({ reportId: command.reportId })) === null) throw new ReportNotFoundError();

    const explanation = command.explanation === null || command.explanation.trim() === '' ? null : command.explanation;
    await this.figures.explain({ ...command, explanation });
  }
}
