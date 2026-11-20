import { OPERAND_SOURCE, type Derivation } from '../models/derivation.model';

/** One derivation input a validation run evaluates: its key, the modules it counts in, and what the reporter stored. */
export interface InputInScope {
  readonly key: string;
  /** The modules of the figure it feeds — where its box is, and where a finding on it counts. */
  readonly modules: readonly string[];
  /** The stored answer as a decimal string — a yes or a no as `1` or `0` — or `null` where nothing is stored. */
  readonly value: string | null;
}

/**
 * **The derivation inputs a report's validation evaluates** (task 254; FR-29, FR-40; `architecture.md` §12.5.6's
 * task-254 row (1)) — the keyless operands of every computed figure in the report's scope, each placed in that figure's
 * modules, with what the reporter stored.
 *
 * **Keyed off the figure's scope, so an input applies exactly where its figure does**: B10's pay gap below 150
 * employees is out of scope (FR-28), and so are the two pay levels it is worked out from — the screen already hides
 * them with it (task 36.10), and a run requiring them would ask what the step never shows.
 *
 * **Only the operands the reporter types**: a disclosure operand — B9's accident count, B1's headcount — is a field of
 * the report already, in scope by its own placement. An input with a published offer — EFRAG's 2 000-hour year — is in
 * scope too, so a rule could name it, though none needs to: the figure computes with the offer.
 *
 * Sorted by key, so two runs over one report agree on the order whatever the artefact's.
 */
export function inputsInScope(input: {
  /** The report's evaluation scope: each element, with the modules it counts in. */
  readonly scope: ReadonlyMap<string, readonly string[]>;
  readonly derivations: ReadonlyMap<string, Derivation>;
  /** What the reporter has stored, by input key. */
  readonly stored: ReadonlyMap<string, string>;
}): readonly InputInScope[] {
  const modulesByInput = new Map<string, Set<string>>();
  for (const derivation of input.derivations.values()) {
    const modules = input.scope.get(derivation.element);
    if (modules === undefined) continue;
    for (const operand of Object.values(derivation.operands)) {
      if (operand.from !== OPERAND_SOURCE.INPUT) continue;
      const placed = modulesByInput.get(operand.key) ?? new Set<string>();
      for (const module of modules) placed.add(module);
      modulesByInput.set(operand.key, placed);
    }
  }
  return [...modulesByInput]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, modules]) => ({ key, modules: [...modules], value: input.stored.get(key) ?? null }));
}
