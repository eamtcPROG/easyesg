import type { Calculator, GhgScope } from '@easyesg/contracts';

/**
 * UX-44's notice, decided (task 39.2; §12.5.6's task-39 row (4)): **a newer set is in force than the one the latest run
 * pinned**, named by both labels, with each B3 figure *now* — what the run stored, what B3 holds — and *would be* —
 * what the lines come to against the set in force. `null` where there is nothing to say: no run yet, no set in force,
 * or the run pinned the set in force.
 *
 * **Nothing is stored about it**: the notice stands while the two differ and leaves when the report is recalculated.
 * A filed figure is never restated behind the reader's back (P7) — the offer is a run, which the reader makes.
 */
export interface FactorChange {
  /** The pinned set's label, or `null` where its pin reads as nothing. */
  readonly pinned: string | null;
  readonly current: string;
  readonly figures: readonly {
    readonly ghgScope: GhgScope;
    readonly now: string | null;
    readonly wouldBe: string | null;
  }[];
}

export function factorChange(calculator: Pick<Calculator, 'factorSet' | 'latestRun' | 'working'>): FactorChange | null {
  const { factorSet, latestRun, working } = calculator;
  if (factorSet === null || latestRun === null || working === null) return null;
  if (latestRun.factorSet.country === factorSet.country && latestRun.factorSet.revision === factorSet.revision) {
    return null;
  }
  const stored = new Map(latestRun.results.map((result) => [result.elementKey, result.tonnesCo2e]));
  return {
    pinned: latestRun.factorSet.label,
    current: factorSet.label,
    figures: working.scopes.map((scope) => ({
      ghgScope: scope.ghgScope,
      now: stored.get(scope.elementKey) ?? null,
      wouldBe: scope.tonnesCo2e,
    })),
  };
}
