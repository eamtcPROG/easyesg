import { reproduces, resultFigures, runResults } from '../domain/run-results';
import type { ScopeTotal } from '../domain/scope-total';
import { CalcRunNotFoundError } from '../errors/calculator.errors';
import type { CalcRunStore } from '../interfaces/calc-run-store.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { StoredCalcRun } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';

/**
 * One recorded run, computed again from what it retained — NFR-19's replay, and UX-42's derivation (task 38.4).
 *
 * **Against the run's own pinned set, never the one in force**: `FACTOR_SETS.pinned` reads the revision the run
 * recorded, after a correction has superseded it, after its window has closed, after a revert has moved the slot back
 * past it. So the answer is what the run computed when it was recorded, and `reproduces` says whether it still is.
 * The same `runResults` call the run made produces it, so a divergence means the arithmetic or the retained inputs
 * changed — what NFR-19's nightly replay over a report corpus, task 46.4's, exists to catch.
 *
 * **A pin naming no readable set is a broken invariant, not an answer**: every recorded run pinned a set the catalog
 * read, and published revisions are immutable. Thrown as an internal error rather than answered `reproduces: false`,
 * which would read as a calculation that changed rather than a platform that lost its record.
 */
export class ReadCalcRun {
  constructor(
    private readonly runs: CalcRunStore,
    private readonly factorSets: FactorSets,
  ) {}

  async execute(query: { readonly reportId: string; readonly runId: string }): Promise<{
    readonly run: StoredCalcRun;
    readonly factorSet: FactorSet;
    readonly scopes: readonly ScopeTotal[];
    readonly reproduces: boolean;
  }> {
    const run = await this.runs.find(query);
    if (run === null) throw new CalcRunNotFoundError();

    const factorSet = await this.factorSets.pinned(run.factorSet);
    if (factorSet === null) {
      throw new Error(`Run ${run.id} is pinned to ${run.factorSet.country}/${run.factorSet.revision}, which reads as nothing`);
    }

    const scopes = runResults({ inputs: run.inputs, factorSet });
    return { run, factorSet, scopes, reproduces: reproduces({ stored: run.results, recomputed: resultFigures(scopes) }) };
  }
}
