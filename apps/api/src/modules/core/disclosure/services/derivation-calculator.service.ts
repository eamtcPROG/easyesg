import { Injectable } from '@nestjs/common';
import type { DisclosureValueStore } from '../interfaces/disclosure-value-store.interface';
import type { DerivationInputStore } from '../interfaces/derivation-input-store.interface';
import { OPERAND_SOURCE, computeDerivation, type Derivation } from '../models/derivation.model';
import type { DerivationService } from './derivation.service';

/**
 * Recompute the figures EFRAG derives, after something they are computed from moves (task 36.10).
 *
 * **Only the derivations a write actually touched.** Autosave writes on every settled field, and
 * recomputing both rates on a B2 narrative keystroke would be two reads and two writes for an answer
 * that cannot have changed. `touchedBy` is a set membership test over the operand keys, which is the
 * whole of the optimisation and needs no invalidation to go stale.
 *
 * **A derivation is recomputed whole, from the store, never from the command.** The command carries
 * the field that just moved; the formula needs all of its operands, and the others are wherever the
 * last write left them. Computing from the command plus remembered state is how a rate comes to
 * reflect an accident count from one request and a headcount from another.
 *
 * **An unanswerable derivation clears the figure rather than leaving it.** A rate whose operands are
 * no longer all present is not *the old rate* — it is no rate, and a stale computed number carrying
 * `origin = 'calculated'` says the system stands behind an answer it can no longer produce.
 */
@Injectable()
export class DerivationCalculator {
  constructor(
    private readonly derivations: DerivationService,
    private readonly values: DisclosureValueStore,
    private readonly inputs: DerivationInputStore,
  ) {}

  /**
   * Recompute every derivation one of `touched` feeds, and answer what was written.
   *
   * `touched` names element keys, input keys, or both — a disclosure write supplies the first and a
   * derivation-input write the second, and a derivation reads from both kinds, so one parameter that
   * holds either is the shape that does not need the caller to know which sources a formula uses.
   */
  async recompute(command: {
    readonly reportId: string;
    readonly standard: string;
    readonly touched: ReadonlySet<string>;
  }): Promise<void> {
    const registered = [...this.derivations.all({ standard: command.standard }).values()].filter(
      (derivation) => touchedBy(derivation, command.touched),
    );
    if (registered.length === 0) return;

    // One read of each store for however many derivations qualify, rather than one per derivation:
    // both rates read B1's headcount today, so a per-derivation read would fetch it twice.
    const [values, inputs] = await Promise.all([
      this.values.forReport({ reportId: command.reportId }),
      this.inputs.forReport({ reportId: command.reportId }),
    ]);

    // The undimensioned row is the only one a derivation reads: every operand of both formulas is a
    // whole-report figure, and a rate computed per pollutant or per country would be a different
    // disclosure than the one the taxonomy carries.
    const byElement = new Map(
      values
        .filter((value) => value.dimensionKey === '' && value.ordinal === 0)
        .map((value) => [value.elementKey, value.valueNumeric]),
    );
    const byInput = new Map(inputs.map((input) => [input.inputKey, input.valueNumeric]));

    for (const derivation of registered) {
      const operands: Record<string, string | null> = {};
      for (const [name, operand] of Object.entries(derivation.operands)) {
        operands[name] =
          operand.from === OPERAND_SOURCE.DISCLOSURE
            ? (byElement.get(operand.key) ?? null)
            : // The published offer stands in for an input nobody has answered, which is what makes
              // EFRAG's 2 000-hour default reachable without writing a row on the reporter's behalf.
              (byInput.get(operand.key) ?? operand.fallback);
      }
      await this.values.writeDerived({
        key: {
          reportId: command.reportId,
          elementKey: derivation.element,
          dimensionKey: '',
          ordinal: 0,
        },
        valueNumeric: computeDerivation({ formula: derivation.formula, operands }),
      });
    }
  }
}

/** Does this derivation read any of the keys that just moved? */
const touchedBy = (derivation: Derivation, touched: ReadonlySet<string>): boolean =>
  Object.values(derivation.operands).some((operand) => touched.has(operand.key));
