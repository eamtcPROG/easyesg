import type { ValueIndex } from '../value-index.js';

/**
 * What each kind's evaluator reads (task 40.2): the report's answers, the prior period's comparable ones, and the
 * elements in scope. Built once by `evaluateRules`, so a kind never indexes values itself.
 */
export interface EvaluationContext {
  readonly current: ValueIndex;
  /** Comparable prior values only (FR-45): the caller leaves out an element that is absent or changed shape. */
  readonly prior: ValueIndex;
  readonly scope: ReadonlySet<string>;
}
