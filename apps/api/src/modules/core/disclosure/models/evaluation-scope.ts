import type { DisclosureValue } from './disclosure-value.model';
import { scopeAsks, type ReportScope } from './report.model';

/** A report's answers and its scope, as a validation run reads them (task 41.2). */
export interface ReportEvaluationScope {
  readonly values: readonly DisclosureValue[];
  /** Each element in scope, with the modules it counts in. */
  readonly scope: ReadonlyMap<string, readonly string[]>;
  /** The modules a roll-up lists, in the standard's order — see `rolledUpModules`. */
  readonly modules: readonly string[];
}

/**
 * What a validation run evaluates over, and where each element counts (task 41.2; FR-28, FR-31, FR-177;
 * `architecture.md` §12.5.6's task-41 row (4), (h)) — the scope `evaluateRules` is given, and the modules the roll-up
 * counts an element in.
 *
 * **An element is in scope where at least one module it is presented in is both asked and still standing**:
 * - **asked** — the report's scope carries the module (D-A): a Basic report is not asked C1–C9, and Comprehensive is
 *   additive over Basic, never instead of it;
 * - **standing** — not declared omitted, whole (task 36.13's derivation);
 * - and the element itself **applies** (FR-28) and is **not withheld by an omitted section** (FR-31, row (4)).
 *
 * The modules returned are the ones it counts in, which is why they are filtered too: an element B3 and C3 share counts
 * in each that stands and is asked, and in no other. An element presented in no module — a pillar's catch-all — is in
 * no step, so nothing could answer it, and it is out of scope.
 *
 * Pure, so every way an element leaves the scope is a unit case rather than a report contrived in the store.
 */
export function evaluationScope(input: {
  readonly elements: readonly { readonly key: string; readonly modules: readonly string[] }[];
  readonly reportScope: ReportScope;
  readonly inapplicable: ReadonlySet<string>;
  readonly omittedModules: ReadonlySet<string>;
  readonly withheld: ReadonlySet<string>;
}): ReadonlyMap<string, readonly string[]> {
  const scope = new Map<string, readonly string[]>();
  for (const element of input.elements) {
    if (input.inapplicable.has(element.key) || input.withheld.has(element.key)) continue;
    const modules = element.modules.filter(
      (module) => scopeAsks({ scope: input.reportScope, module }) && !input.omittedModules.has(module),
    );
    if (modules.length > 0) scope.set(element.key, modules);
  }
  return scope;
}

/**
 * The modules a roll-up lists (task 41.3; FR-41 item 2; UX-21, task 179.1's row) — **every module the report asks and
 * has not omitted, except one FR-28 has ruled out whole**, in the standard's order. **A module waiting on B1 stays**:
 * it will be asked, so it counts as not started rather than leaving the denominator, as the wizard's list draws it.
 * That is why the roll-up's list is not the evaluation scope's: a waiting element is not evaluated — there is nothing
 * yet to say about a field that may not apply — but its module is still owed.
 *
 * `ruledOut` holds the elements FR-28 has decided against with an answer to quote; one with no answer is waiting.
 */
export function rolledUpModules(input: {
  readonly elements: readonly { readonly key: string; readonly modules: readonly string[] }[];
  /** The registered version's modules, in its own order. */
  readonly moduleOrder: readonly string[];
  readonly reportScope: ReportScope;
  readonly omittedModules: ReadonlySet<string>;
  readonly ruledOut: ReadonlySet<string>;
}): readonly string[] {
  const owed = new Set(
    input.elements.flatMap((element) => (input.ruledOut.has(element.key) ? [] : element.modules)),
  );
  return input.moduleOrder.filter(
    (module) =>
      owed.has(module) && scopeAsks({ scope: input.reportScope, module }) && !input.omittedModules.has(module),
  );
}
