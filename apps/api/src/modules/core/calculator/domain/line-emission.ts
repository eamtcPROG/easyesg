import type { CalcInput } from '../models/calc-run.model';
import type { FactorSet, GhgScope } from '../models/factor-set.model';
import { multiplyDecimals } from '@api/contracts/types/decimal';

/**
 * One retained input's emissions — FR-34's two steps for one invoice line (task 38.2; UX-42).
 *
 * **Convert to MWh, then apply the factor**: `quantity × MWh per unit` is the energy the line stands for, and
 * `energy × tCO₂e per MWh` its emissions. Both steps are kept, because UX-42 shows the derivation in one step — input,
 * conversion, factor applied, result — and B3's energy figures are MWh in their own right.
 *
 * **An explained line computes nothing and says so.** *"Billed by the landlord"* is a line of its source's scope with
 * no figure, which the scope's total reports as unmeasured rather than counting as zero.
 *
 * **A line the set does not cover is a defect, not an outcome**: a run checks every copied line against the set it
 * pins before it is recorded (task 38.1), so meeting one here means that check was bypassed, and the arithmetic
 * refuses rather than leaving a source out of a total.
 */
export const LINE_OUTCOME = {
  /** Measured: a figure in a unit the source admits. */
  COMPUTED: 'computed',
  /** Explained: no figure, and the reason why. */
  NOT_AVAILABLE: 'not_available',
  /**
   * Measured, and its computed tonnes replaced by the reporter's own with a reason (task 38.4; UC-34). **Both figures
   * travel**: UX-43 shows the superseded computed value beside the substituted one, and the computed one is this
   * line's own arithmetic, so it is computed here every time rather than stored.
   */
  OVERRIDDEN: 'overridden',
} as const;
export type LineOutcome = (typeof LINE_OUTCOME)[keyof typeof LINE_OUTCOME];

export type LineEmission =
  | {
      readonly outcome: typeof LINE_OUTCOME.COMPUTED;
      readonly sourceId: string;
      readonly ghgScope: GhgScope;
      /** The energy the line stands for, in MWh. */
      readonly megawattHours: string;
      /** Its emissions, in tonnes of CO₂-equivalent, unrounded. */
      readonly tonnesCo2e: string;
    }
  | {
      readonly outcome: typeof LINE_OUTCOME.NOT_AVAILABLE;
      readonly sourceId: string;
      readonly ghgScope: GhgScope;
    }
  | {
      readonly outcome: typeof LINE_OUTCOME.OVERRIDDEN;
      readonly sourceId: string;
      readonly ghgScope: GhgScope;
      readonly megawattHours: string;
      /** What the factors give — superseded, and kept. */
      readonly computedTonnesCo2e: string;
      /** The reporter's figure, which the scope's total counts. */
      readonly tonnesCo2e: string;
      readonly explanation: string;
    };

export function lineEmission(input: { readonly line: CalcInput; readonly factorSet: FactorSet }): LineEmission {
  const { line, factorSet } = input;
  const source = factorSet.sources.get(line.sourceKey);
  if (source === undefined) {
    throw new RangeError(`Source ${line.sourceKey} is not in factor set ${factorSet.pin.country}/${factorSet.pin.revision}`);
  }

  const { quantity, unitCode } = line.contents;
  if (quantity === null || unitCode === null) {
    return { outcome: LINE_OUTCOME.NOT_AVAILABLE, sourceId: line.sourceId, ghgScope: source.ghgScope };
  }

  const perUnit = source.units.get(unitCode);
  if (perUnit === undefined) {
    throw new RangeError(`Unit ${unitCode} is not admitted for ${line.sourceKey} in ${factorSet.pin.country}/${factorSet.pin.revision}`);
  }

  const megawattHours = multiplyDecimals(quantity, perUnit);
  const computed = multiplyDecimals(megawattHours, source.emissionFactor);
  if (line.override !== null) {
    return {
      outcome: LINE_OUTCOME.OVERRIDDEN,
      sourceId: line.sourceId,
      ghgScope: source.ghgScope,
      megawattHours,
      computedTonnesCo2e: computed,
      tonnesCo2e: line.override.tonnesCo2e,
      explanation: line.override.explanation,
    };
  }
  return {
    outcome: LINE_OUTCOME.COMPUTED,
    sourceId: line.sourceId,
    ghgScope: source.ghgScope,
    megawattHours,
    tonnesCo2e: computed,
  };
}
