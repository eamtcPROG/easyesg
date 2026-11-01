import type { CalcInput } from '../models/calc-run.model';
import type { CalcSource } from '../models/calc-source.model';
import type { FactorSet } from '../models/factor-set.model';
import { factorRefusal } from './calc-source-check';
import { runResults } from './run-results';
import type { ScopeTotal } from './scope-total';

/**
 * What the lines on S-09 come to now, against the set the period resolves — the artboard's converted and emissions
 * columns and its running totals, *"both totals move as you type"* (task 39.2; UX-42).
 *
 * **Not a run, and nothing is retained**: §12.5.6's task-38.1 row declined a run per keystroke, and a run is still
 * recorded only when the reader presses *use these figures in B3*. This is the same arithmetic the run will do —
 * `runResults`, over the lines as a run would copy them — so what the screen shows is what the run will store, for as
 * long as nothing changes in between.
 *
 * **A line the set no longer covers is set aside, not thrown on**: a correction published after a line was written can
 * drop its source or its unit, and the run refuses such a line (task 38.1). Here it is named in `uncovered` so the screen
 * can say which line stands in the way, rather than the whole read failing on it.
 */
export function workingResults(input: {
  readonly sources: readonly CalcSource[];
  readonly factorSet: FactorSet;
}): { readonly scopes: readonly ScopeTotal[]; readonly uncovered: readonly string[] } {
  const covered: CalcInput[] = [];
  const uncovered: string[] = [];
  for (const line of input.sources) {
    if (factorRefusal({ sourceKey: line.sourceKey, contents: line.contents, factorSet: input.factorSet }) !== null) {
      uncovered.push(line.sourceId);
      continue;
    }
    covered.push({
      sourceId: line.sourceId,
      siteOrdinal: line.siteOrdinal,
      sourceKey: line.sourceKey,
      description: line.description,
      contents: line.contents,
      override: line.override,
      overriddenBy: line.overriddenBy,
    });
  }
  return { scopes: runResults({ inputs: covered, factorSet: input.factorSet }), uncovered };
}
