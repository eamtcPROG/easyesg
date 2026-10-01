import type { CalcInput } from '../models/calc-run.model';
import { GHG_SCOPE, type FactorSet } from '../models/factor-set.model';
import { scopeTotal, type ScopeTotal } from './scope-total';

/**
 * Gross location-based Scope 2 — purchased energy at the grid-average factor, B3's
 * `GrossLocationBasedScope2GreenhouseGasEmissions` (task 38.3; FR-34, UC-33).
 *
 * **The location-based method is the factor, not the formula.** The arithmetic is Scope 1's — MWh, then the factor,
 * summed exactly (`scope-total.ts`) — and what makes it location-based is that the set's Scope 2 source carries a
 * national grid average (task 37.1's JRC figure for Moldova), not a supplier's mix. A market-based figure would be a
 * different `ghgScope` member over a different factor, and B3 a different element; FR-34 asks for this one alone.
 *
 * **One factor path, not two.** Task 38.3's row kept it apart from 38.2 because *"the factor source and its effective
 * dating differ"*; task 37 put the grid factor in the same set and the same window as the fuels, so a run's single pin
 * covers both scopes (§12.5.6's task-38.2 row).
 *
 * **The grid factor attributes grid losses to consumers**, which the GHG Protocol counts in Scope 3 — so this figure
 * reads slightly high, as §12.5.6's task-37 row records. That is a property of the published factor, corrected by
 * publishing a better one, and nothing here adjusts it.
 */
export function scope2LocationBased(input: {
  readonly inputs: readonly CalcInput[];
  readonly factorSet: FactorSet;
}): ScopeTotal {
  return scopeTotal({ ...input, ghgScope: GHG_SCOPE.SCOPE_2_LOCATION_BASED });
}
