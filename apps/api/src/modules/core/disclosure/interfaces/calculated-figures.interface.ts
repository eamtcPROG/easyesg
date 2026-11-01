/**
 * Figures another module computed, written into a report's disclosures, and UC-34's two verbs over them (task 38.4;
 * UC-33 step 4, UC-34, FR-36).
 *
 * **This module writes its own store**, so the carbon calculator hands its Scope 1 and Scope 2 here rather than
 * reaching `DISCLOSURE_VALUE_STORE` itself: what a computed figure does on arrival — marked `calculated`, a stale
 * computed figure cleared, the derivations it feeds recomputed — and what replacing or explaining one means are the
 * disclosure store's rules, and a second writer would be a second copy of them.
 */
export interface CalculatedFigures {
  /**
   * A run's figures: each written as `calculated`, then every derivation they feed recomputed — B3's total and
   * intensity.
   *
   * **`null` clears a figure only where the store holds a computed one** (§12.5.6's task-38.4 row): a scope with no
   * measured line leaves a typed figure alone, and clears an earlier run's, so a computed number never outlives its
   * lines. **A run replaces an override** (the project owner, 1 Oct 2026): pressing *use these figures in B3* is the
   * reporter's own act, and the override and its reason stay in the field's history. **An annotation on a figure that
   * stays computed is kept.**
   */
  write(command: {
    readonly reportId: string;
    readonly standard: string;
    readonly figures: readonly { readonly elementKey: string; readonly valueNumeric: string | null }[];
  }): Promise<void>;

  /**
   * UC-34's *replace*: a computed figure superseded by the reporter's own, with the reason (UX-43). Refused for a
   * figure nothing computed. The computed figure it supersedes is the run's stored result, which stays.
   */
  override(command: {
    readonly reportId: string;
    readonly standard: string;
    readonly elementKey: string;
    readonly valueNumeric: string;
    readonly explanation: string;
  }): Promise<void>;

  /** The override removed: the computed figure back in force, as `calculated`. Nothing to do where none stands. */
  restore(command: {
    readonly reportId: string;
    readonly standard: string;
    readonly elementKey: string;
    readonly valueNumeric: string | null;
  }): Promise<void>;

  /** UC-34's *explain*: a note on a computed figure that stands, or `null` to remove it. Refused for any other. */
  explain(command: {
    readonly reportId: string;
    readonly elementKey: string;
    readonly explanation: string | null;
  }): Promise<void>;
}

/** DI token beside the interface, as every other port in this module is (P-7). */
export const CALCULATED_FIGURES = Symbol('CALCULATED_FIGURES');
