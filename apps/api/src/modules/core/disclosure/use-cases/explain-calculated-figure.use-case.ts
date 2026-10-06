import { NoComputedFigureError } from '../errors/report.errors';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import { DISCLOSURE_ORIGIN, NO_DIMENSION } from '../models/disclosure-value.model';

/**
 * UC-34's *explain* — a note on a computed B3 figure that still stands (task 38.4; FR-36).
 *
 * **Only a figure the calculator stands behind**: `calculated`, with a value. An overridden figure's words are its
 * reason, changed by overriding again; a typed figure is the reporter's and needs no note to say so. The figure itself
 * is untouched, so nothing it feeds is recomputed.
 */
export class ExplainCalculatedFigure {
  constructor(private readonly values: DisclosureValueStore) {}

  async execute(command: {
    readonly reportId: string;
    readonly elementKey: string;
    readonly explanation: string | null;
  }): Promise<void> {
    const key = { reportId: command.reportId, elementKey: command.elementKey, dimensionKey: NO_DIMENSION, ordinal: 0 };
    const standing = await this.values.find(key);
    if (standing?.origin !== DISCLOSURE_ORIGIN.CALCULATED || standing.valueNumeric === null) {
      throw new NoComputedFigureError();
    }

    await this.values.writeFigure({
      key,
      valueNumeric: standing.valueNumeric,
      origin: DISCLOSURE_ORIGIN.CALCULATED,
      explanation: command.explanation,
    });
  }
}
