import type { CalcRun } from '../models/calc-run.model';
import type { FactorSetPin } from '../models/factor-set.model';

/**
 * Calculation runs and the inputs they retain — `core.calc_run` and `core.calc_input` (task 38.1; P-11, FR-35).
 *
 * **One method, and it copies in the database.** A run's inputs are the report's lines *as they stand when the run is
 * recorded*, so the copy is an `INSERT ... SELECT` from the lines in the same transaction as the run — never a list the
 * caller read a moment earlier and passed back, which a concurrent edit could make stale and which a caller could
 * substitute. What the run retains is what the table held; the method answers it so the use case can check it.
 */
export interface CalcRunStore {
  /**
   * Record a run of the report's lines, pinned to `factorSet`. Answers the run with every input it copied, or `null`
   * where the report is not the bound tenant's or does not exist.
   */
  record(command: { readonly reportId: string; readonly factorSet: FactorSetPin }): Promise<CalcRun | null>;
}

/** DI token beside the interface, as every port in `core/` is (P-7). */
export const CALC_RUN_STORE = Symbol('CALC_RUN_STORE');
