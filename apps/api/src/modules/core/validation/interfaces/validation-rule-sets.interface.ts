import type { RuleSet } from '@easyesg/validation';

/** The rule set a date reads, and which published revision it is — a run records both (§12.5.6's task-41 row (g)). */
export interface RuleSetInForce {
  readonly ruleSet: RuleSet;
  readonly revision: number;
}

/**
 * Validation rule sets, read through a port (task 41.1; FR-73, AD-4).
 *
 * **Two questions, and neither is "the current set"** — `FactorSets`' shape. An open report asks which set is in force
 * on a day, the caller's — today, in the period's own zone (`ruleSetDate`); a locked one asks for the revision its lock
 * pinned (row (5)). A convenience answering *the rules in force now* is the shape this port declines, because it is how
 * a locked report's findings would move under a later rule.
 */
export interface ValidationRuleSets {
  /**
   * The set in force on `on`, a calendar date `YYYY-MM-DD` — `null` where none is, or where the one in force cannot be
   * read. **Null is a refusal, never an empty set** (§12.5.6's task-41 row (d)): a run with no rules finds nothing and
   * would read ready to file.
   */
  inForce(query: { readonly on: string }): RuleSetInForce | null;

  /**
   * The set a lock pinned, by its revision, whether or not it is still in force — after a later rule replaced it, after
   * a revert moved the slot past it (FR-73 item 9; §12.5.6's task-41 row (5)). `null` only where the revision names no
   * readable version, which a recorded pin never should.
   */
  pinned(query: { readonly revision: number }): Promise<RuleSetInForce | null>;
}

/** DI token beside the interface, as every port in `core/` is (P-7). */
export const VALIDATION_RULE_SETS = Symbol('VALIDATION_RULE_SETS');
