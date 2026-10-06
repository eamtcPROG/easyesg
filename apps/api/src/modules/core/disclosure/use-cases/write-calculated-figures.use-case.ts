import type { DerivationRecalculator } from '../interfaces/derivation.interface';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import { DISCLOSURE_ORIGIN, NO_DIMENSION, type DisclosureValue } from '../models/disclosure-value.model';

/**
 * UC-33 step 4 — a run's computed figures written into the report, and what they feed recomputed (task 38.4).
 *
 * **A figure is written undimensioned at ordinal 0**: B3's Scope 1 and Scope 2 are on `ReportingScopesAxis`, whose
 * default member *is* the answer (task 36.5), and every whole-report figure a computation produces is that row.
 *
 * **What a measured figure replaces is not checked**: the reporter pressed *use these figures in B3*, and the figure
 * they asked for is the one written — over a typed value, over an earlier run's, and over an override, whose reason
 * then goes with it (the project owner, 1 Oct 2026); the field's trail keeps both. **An annotation on a figure that was
 * already computed is kept**: it explains the figure, and the figure is still the calculator's. **What an empty one
 * clears is checked**: only a `calculated` row, so a figure a person typed survives a run that measured nothing of
 * its scope.
 *
 * The lock is the store's trigger, as for every other write here.
 */
export class WriteCalculatedFigures {
  constructor(
    private readonly values: DisclosureValueStore,
    private readonly recalculator: DerivationRecalculator,
  ) {}

  async execute(command: {
    readonly reportId: string;
    readonly standard: string;
    readonly figures: readonly { readonly elementKey: string; readonly valueNumeric: string | null }[];
  }): Promise<void> {
    const stored = new Map<string, DisclosureValue>(
      (await this.values.forReport({ reportId: command.reportId }))
        .filter((value) => value.dimensionKey === NO_DIMENSION && value.ordinal === 0)
        .map((value) => [value.elementKey, value]),
    );

    for (const figure of command.figures) {
      const standing = stored.get(figure.elementKey);
      if (figure.valueNumeric === null && standing?.origin !== DISCLOSURE_ORIGIN.CALCULATED) continue;
      await this.values.writeFigure({
        key: { reportId: command.reportId, elementKey: figure.elementKey, dimensionKey: NO_DIMENSION, ordinal: 0 },
        valueNumeric: figure.valueNumeric,
        origin: DISCLOSURE_ORIGIN.CALCULATED,
        // A note on a figure that stays computed stays with it; there is nothing to explain once it is cleared.
        explanation:
          figure.valueNumeric !== null && standing?.origin === DISCLOSURE_ORIGIN.CALCULATED ? standing.explanation : null,
      });
    }

    // Every figure counts as touched, written or not: the derivations read the store as it now stands, so recomputing
    // over an unchanged operand writes the same answer, and skipping one could leave a total over a cleared scope.
    await this.recalculator.recompute({
      reportId: command.reportId,
      standard: command.standard,
      touched: new Set(command.figures.map((figure) => figure.elementKey)),
    });
  }
}
