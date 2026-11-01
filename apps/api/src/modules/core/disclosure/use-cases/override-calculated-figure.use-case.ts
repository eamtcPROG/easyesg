import { NoComputedFigureError } from '../errors/report.errors';
import type { DerivationRecalculator } from '../interfaces/derivation.interface';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import { DISCLOSURE_ORIGIN, NO_DIMENSION } from '../models/disclosure-value.model';

/**
 * UC-34's *replace* — a computed B3 figure superseded by the reporter's own, with the reason (task 38.4; FR-36,
 * UX-43).
 *
 * **Only a computed figure can be overridden**: one the calculator wrote and still stands behind (`calculated`, with a
 * value), or one already overridden, whose figure and reason this changes. A typed figure has nothing computed under
 * it to supersede, and calling it an override would claim one.
 *
 * **The superseded figure is not copied here**: it is the run's own stored result, retained permanently, and the
 * field's per-field trail records the change with its author. **The reason is required by the table** as well as by the
 * calculator's check, so an override without one cannot be written by any path.
 *
 * The total and intensity read the scopes, so they are recomputed over the override.
 */
export class OverrideCalculatedFigure {
  constructor(
    private readonly values: DisclosureValueStore,
    private readonly recalculator: DerivationRecalculator,
  ) {}

  async execute(command: {
    readonly reportId: string;
    readonly standard: string;
    readonly elementKey: string;
    readonly valueNumeric: string;
    readonly explanation: string;
  }): Promise<void> {
    const key = { reportId: command.reportId, elementKey: command.elementKey, dimensionKey: NO_DIMENSION, ordinal: 0 };
    const standing = await this.values.find(key);
    const computed =
      standing !== null &&
      (standing.origin === DISCLOSURE_ORIGIN.OVERRIDDEN ||
        (standing.origin === DISCLOSURE_ORIGIN.CALCULATED && standing.valueNumeric !== null));
    if (!computed) throw new NoComputedFigureError();

    await this.values.writeFigure({
      key,
      valueNumeric: command.valueNumeric,
      origin: DISCLOSURE_ORIGIN.OVERRIDDEN,
      explanation: command.explanation,
    });
    await this.recalculator.recompute({
      reportId: command.reportId,
      standard: command.standard,
      touched: new Set([command.elementKey]),
    });
  }
}
