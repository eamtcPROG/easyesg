import type { CalcResult, CalcRun, LatestCalcRun, StoredCalcRun } from '../models/calc-run.model';
import type { FactorSetPin } from '../models/factor-set.model';

/**
 * Calculation runs, the inputs they retain and the results they computed — `core.calc_run`, `core.calc_input` and
 * `core.calc_result` (tasks 38.1, 38.4; P-11, FR-35, NFR-19).
 *
 * **Recording copies in the database.** A run's inputs are the report's lines *as they stand when the run is
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

  /** Store what a run computed (task 38.4), in the run's own transaction, so a run and its results land together. */
  recordResults(command: {
    readonly reportId: string;
    readonly runId: string;
    readonly results: readonly CalcResult[];
  }): Promise<void>;

  /** One recorded run of the report with its inputs and stored results — `null` where it is not the report's. */
  find(query: { readonly reportId: string; readonly runId: string }): Promise<StoredCalcRun | null>;

  /**
   * What the report's latest run computed for one B3 figure — the computed figure an override superseded, which
   * restoring it puts back (task 38.4). `null` where that run measured nothing of the scope; `undefined` where no run
   * has computed the figure at all.
   */
  latestResult(query: { readonly reportId: string; readonly elementKey: string }): Promise<string | null | undefined>;

  /** The report's latest run with what it stored (task 39.2), or `null` where none has been recorded. */
  latest(query: { readonly reportId: string }): Promise<LatestCalcRun | null>;
}

/** DI token beside the interface, as every port in `core/` is (P-7). */
export const CALC_RUN_STORE = Symbol('CALC_RUN_STORE');
