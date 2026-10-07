import type { CalcScopeLine, Calculator } from '@easyesg/contracts';
import { lineResults } from './line-results';

/**
 * What the board knows about the computation around its lines, read once from the calculator's figures and handed down
 * whole (task 39.2; `section-compute-once`): each line's working figures, the lines the set in force no longer covers,
 * the set's label and the places every figure rounds to. A row asks it about itself rather than receiving five props.
 */
export interface Computation {
  readonly results: ReadonlyMap<string, CalcScopeLine>;
  readonly uncovered: ReadonlySet<string>;
  readonly setLabel: string | null;
  readonly precision: Readonly<Record<string, number>>;
}

export const computationOf = (calculator: Pick<Calculator, 'working' | 'factorSet' | 'precision'>): Computation => ({
  results: lineResults(calculator.working),
  uncovered: new Set(calculator.working?.uncovered ?? []),
  setLabel: calculator.factorSet?.label ?? null,
  precision: calculator.precision,
});
