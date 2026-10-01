import type { FactorSet, FactorSetPin } from '../models/factor-set.model';

/**
 * Emission factor sets, read through a port (task 37.2; FR-34, FR-35, FR-71).
 *
 * **Two questions, and neither is "the current set".** A run asks which set serves its reporting period, once, and
 * records the answer's pin (task 38.1); everything after — a replay, a re-export, the derivation on screen — asks for
 * *that* set by its pin. A convenience answering "the factors in force today" is the shape that silently recalculates
 * a filed figure against factors it was never computed under, which FR-35 exists to stop.
 *
 * A port for the reason `Derivations` gives: the use case asks what a set says, and that it lives in the configuration
 * store, is cached per revision and degrades to nothing on a malformed payload is the adapter's business.
 */
export interface FactorSets {
  /**
   * The set in force for a reporting period starting on `periodStart` — `null` where none is, which is a refusal to
   * guess rather than an empty set.
   *
   * **The period's start, not the day the run happens** (the project owner, 1 Oct 2026; `architecture.md` §12.5.6's
   * task-37 row). Factors are chosen for the reported year, as A-05 publishes them — *"applies to reporting periods
   * starting on or after"* — and as a taxonomy is pinned (`pinFor({ on: periodStart })`): a FY2026 report calculated in
   * March 2027 uses the factors for FY2026. A **calendar date** (NFR-34), the period's own, already stored with the
   * timezone that settles it.
   */
  inForce(query: { readonly country: string; readonly periodStart: string }): FactorSet | null;

  /**
   * The set a run is pinned to, whether or not it is still in force — after a correction superseded it inside its
   * window, after its window closed, after a revert moved the slot back past it. `null` only where the pin names no
   * readable version, which a recorded pin never should.
   */
  pinned(pin: FactorSetPin): Promise<FactorSet | null>;
}

/** DI token beside the interface, as every port in `core/` is (P-7). */
export const FACTOR_SETS = Symbol('FACTOR_SETS');
