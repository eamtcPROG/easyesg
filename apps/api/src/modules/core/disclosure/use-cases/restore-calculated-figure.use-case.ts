import type { DerivationRecalculator } from '../interfaces/derivation.interface';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import { DISCLOSURE_ORIGIN, NO_DIMENSION } from '../models/disclosure-value.model';

/**
 * An override removed — the computed figure back in force (task 38.4; UC-34, S-09's *"reverting is one action"*).
 *
 * **The figure put back is the one the calculator supplies**, its latest run's stored result: an override superseded
 * a computed figure and never deleted it, so returning to it needs nothing re-entered. **Nothing happens where no
 * override stands** — the caller's intended end state already holds, and a replayed request must not fail.
 */
export class RestoreCalculatedFigure {
  constructor(
    private readonly values: DisclosureValueStore,
    private readonly recalculator: DerivationRecalculator,
  ) {}

  async execute(command: {
    readonly reportId: string;
    readonly standard: string;
    readonly elementKey: string;
    readonly valueNumeric: string | null;
  }): Promise<void> {
    const key = { reportId: command.reportId, elementKey: command.elementKey, dimensionKey: NO_DIMENSION, ordinal: 0 };
    const standing = await this.values.find(key);
    if (standing?.origin !== DISCLOSURE_ORIGIN.OVERRIDDEN) return;

    await this.values.writeFigure({
      key,
      valueNumeric: command.valueNumeric,
      origin: DISCLOSURE_ORIGIN.CALCULATED,
      explanation: null,
    });
    await this.recalculator.recompute({
      reportId: command.reportId,
      standard: command.standard,
      touched: new Set([command.elementKey]),
    });
  }
}
