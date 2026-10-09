import type { DisclosureLabel } from '@easyesg/i18n';
import type { EvaluatedApplicability } from '../models/applicability.model';
import type { DisclosureApplicabilityCause } from '../models/wizard-step.model';

/**
 * The evaluated cause with its wording joined — the one place a driver key becomes a label (task 91.3).
 *
 * Separate from the evaluation because the evaluation is pure and locale-free: what a rule read is
 * a fact about the report, and what to call it is a fact about the reader (task 33.2). **Shared by the module list and
 * the step**, which announce the same cause (UX-27), so the two cannot word one rule differently.
 */
export const toCause = (
  evaluated: EvaluatedApplicability | undefined,
  catalogue: Readonly<Record<string, DisclosureLabel>> | null,
): DisclosureApplicabilityCause | null =>
  evaluated === undefined
    ? null
    : {
        condition: evaluated.cause.condition,
        drivers: evaluated.cause.driverKeys.map((elementKey) => ({
          elementKey,
          label: catalogue?.[elementKey]?.text ?? null,
        })),
        threshold: evaluated.cause.threshold,
        answer: evaluated.cause.answer,
      };
