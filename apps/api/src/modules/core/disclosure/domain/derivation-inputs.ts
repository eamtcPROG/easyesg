import { OPERAND_SOURCE, type Derivation } from '../models/derivation.model';
import type { DerivationInputField } from '../models/wizard-step.model';

/**
 * The derivation inputs a step should show — the ones feeding a figure this step actually carries (task 36.10).
 *
 * **Keyed off the step's own elements, not off the artefact.** A report has one
 * `HoursWorkedByOneFullTimeEmployee`, and it is B9's question; serving every registered input on
 * every step would put B8's three turnover figures on B2. A pure function so the ordering and the
 * offer-versus-answer distinction are unit-testable without a store.
 *
 * Sorted by key, so two reads of one step agree on the order — the artefact's own order is an
 * author's choice and nothing in the type says it is stable.
 */
export function derivationInputsFor(query: {
  readonly elements: readonly string[];
  readonly derivations: ReadonlyMap<string, Derivation>;
  readonly stored: ReadonlyMap<string, string>;
}): readonly DerivationInputField[] {
  const onThisStep = new Set(query.elements);
  const fields: DerivationInputField[] = [];
  for (const derivation of query.derivations.values()) {
    if (!onThisStep.has(derivation.element)) continue;
    for (const operand of Object.values(derivation.operands)) {
      // A disclosure operand is already a field of its own — B9's accident count is on the step
      // above this list, and B1's headcount is B1's question. Only the keyless ones belong here.
      if (operand.from !== OPERAND_SOURCE.INPUT) continue;
      fields.push({
        key: operand.key,
        derives: derivation.element,
        value: query.stored.get(operand.key) ?? null,
        offered: operand.fallback,
      });
    }
  }
  return fields.sort((a, b) => a.key.localeCompare(b.key));
}
