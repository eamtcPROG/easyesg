import { Injectable } from '@nestjs/common';
import type { CalculatedFigures } from '../interfaces/calculated-figures.interface';
import { ExplainCalculatedFigure } from '../use-cases/explain-calculated-figure.use-case';
import { OverrideCalculatedFigure } from '../use-cases/override-calculated-figure.use-case';
import { RestoreCalculatedFigure } from '../use-cases/restore-calculated-figure.use-case';
import { WriteCalculatedFigures } from '../use-cases/write-calculated-figures.use-case';

/**
 * `CALCULATED_FIGURES` — the port the carbon calculator writes B3 through (task 38.4), as this module's service seam:
 * the four operations are four use cases, and this is what composes them behind one interface (`apps/api/CLAUDE.md`,
 * "Module anatomy": services call use cases).
 */
@Injectable()
export class CalculatedFiguresService implements CalculatedFigures {
  constructor(
    private readonly writeFigures: WriteCalculatedFigures,
    private readonly overrideFigure: OverrideCalculatedFigure,
    private readonly restoreFigure: RestoreCalculatedFigure,
    private readonly explainFigure: ExplainCalculatedFigure,
  ) {}

  write(command: Parameters<CalculatedFigures['write']>[0]): Promise<void> {
    return this.writeFigures.execute(command);
  }

  override(command: Parameters<CalculatedFigures['override']>[0]): Promise<void> {
    return this.overrideFigure.execute(command);
  }

  restore(command: Parameters<CalculatedFigures['restore']>[0]): Promise<void> {
    return this.restoreFigure.execute(command);
  }

  explain(command: Parameters<CalculatedFigures['explain']>[0]): Promise<void> {
    return this.explainFigure.execute(command);
  }
}
