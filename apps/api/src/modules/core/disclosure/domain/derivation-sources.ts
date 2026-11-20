import type { DisclosureLabel } from '@easyesg/i18n';
import { OPERAND_SOURCE, type Derivation } from '../models/derivation.model';
import type { DerivationSource } from '../models/wizard-step.model';

/**
 * **What a computed figure is worked out from, for the screen to name while it waits** (task 254; FR-29, UC-27;
 * `architecture.md` §12.5.6's task-254 row (2), `design_spec.md` S-07's amendment of 20 Nov 2026) — each operand the
 * reporter answers, in the formula's own order: a disclosure by its label and the module that asks it, an input by its
 * key, which the browser words and which sits beneath the figure on this step.
 *
 * **An operand with a published offer is left out**: EFRAG's 2 000-hour year stands in until the reporter states their
 * own, so the figure never waits on it, and naming it among what is missing would ask for an answer nothing requires.
 *
 * **Empty for a figure the platform does not compute**, which is how a reader tells the two apart without a flag.
 *
 * Pure, so the naming is a spec rather than a journey: the caller passes the version's labels and where each element is
 * asked.
 */
export function derivationSources(input: {
  readonly derivation: Derivation | undefined;
  readonly catalogue: Readonly<Record<string, DisclosureLabel>> | null;
  /** The module whose step asks an element (`moduleResolver`). */
  readonly moduleOf: (elementKey: string) => string | null;
}): readonly DerivationSource[] {
  if (input.derivation === undefined) return [];
  return Object.values(input.derivation.operands)
    .filter((operand) => operand.fallback === null)
    .map((operand) =>
      operand.from === OPERAND_SOURCE.DISCLOSURE
        ? {
            source: OPERAND_SOURCE.DISCLOSURE,
            key: operand.key,
            label: input.catalogue?.[operand.key]?.text ?? null,
            module: input.moduleOf(operand.key),
          }
        : { source: OPERAND_SOURCE.INPUT, key: operand.key, label: null, module: null },
    );
}
