import type { CalcInput } from '../models/calc-run.model';
import type { FactorSet, GhgScope } from '../models/factor-set.model';
import { sumDecimals } from '@api/contracts/types/decimal';
import { LINE_OUTCOME, lineEmission, type LineEmission } from './line-emission';

/**
 * One GHG scope's total over a run's inputs (task 38.2; FR-34, UC-33).
 *
 * **Summed unrounded, rounded never here** — S-09's *"totals are summed unrounded and rounded once, at the end"*, and
 * the end is presentation. The sum is exact (`contracts/types/decimal.ts`), so a total is the same number however its
 * lines are ordered.
 *
 * **`null`, not zero, where no line of the scope was measured.** FR-30 turns on the difference: zero is a nil return,
 * an affirmative answer someone files, and a company whose calculator holds no fuel line has not said it burns none.
 * A scope whose every line is explained is the same case — nothing measured — and its explained lines are what the
 * report says instead. A scope with some lines measured and some explained totals the measured ones and lists the
 * rest, which is the artboard's *"one site of two · Cahul reasoned as unavailable"*.
 */
export interface ScopeTotal {
  readonly ghgScope: GhgScope;
  /** Tonnes of CO₂-equivalent, unrounded; `null` where no line of the scope was measured. */
  readonly tonnesCo2e: string | null;
  /** Every line of the scope, measured or explained, in the run's order — the derivation UX-42 shows. */
  readonly lines: readonly LineEmission[];
  /** The lines of the scope with no figure — what the total does not include. */
  readonly unmeasured: readonly string[];
}

export function scopeTotal(input: {
  readonly inputs: readonly CalcInput[];
  readonly factorSet: FactorSet;
  readonly ghgScope: GhgScope;
}): ScopeTotal {
  const lines = input.inputs
    .map((line) => lineEmission({ line, factorSet: input.factorSet }))
    .filter((emission) => emission.ghgScope === input.ghgScope);

  const measured: string[] = [];
  const unmeasured: string[] = [];
  for (const line of lines) {
    // An overridden line was measured: its total counts the reporter's figure, which is the one the report states.
    if (line.outcome === LINE_OUTCOME.NOT_AVAILABLE) unmeasured.push(line.sourceId);
    else measured.push(line.tonnesCo2e);
  }

  return {
    ghgScope: input.ghgScope,
    tonnesCo2e: measured.length === 0 ? null : sumDecimals(measured),
    lines,
    unmeasured,
  };
}
