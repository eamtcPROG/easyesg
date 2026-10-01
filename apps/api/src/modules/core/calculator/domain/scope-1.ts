import type { CalcInput } from '../models/calc-run.model';
import { GHG_SCOPE, type FactorSet } from '../models/factor-set.model';
import { scopeTotal, type ScopeTotal } from './scope-total';

/**
 * Gross Scope 1 — direct emissions from the fuel the undertaking burns, B3's `GrossScope1GreenhouseGasEmissions`
 * (task 38.2; FR-34, UC-33).
 *
 * **Domain code, nothing else** — no NestJS, no TypeORM, no HTTP — so `scope-1.spec.ts` computes it with no database
 * and no broker, which is the dependency rule's own check. What makes a source Scope 1 is the factor set's
 * `ghgScope`, not a list of fuels here: a source registered in the set (task 37.1) is counted with no code change.
 *
 * **Biogenic CO₂ is not in it**, because it is not in the factor: the shipped set's wood factor carries CH₄ and N₂O
 * only, as IPCC 2006 records biomass CO₂ outside the national totals (§12.5.6's task-37 row).
 */
export function scope1(input: { readonly inputs: readonly CalcInput[]; readonly factorSet: FactorSet }): ScopeTotal {
  return scopeTotal({ ...input, ghgScope: GHG_SCOPE.SCOPE_1 });
}
