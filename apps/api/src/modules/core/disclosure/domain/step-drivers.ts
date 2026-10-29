import type { ApplicabilityConditionSpec, ApplicabilityRule } from '../models/applicability.model';
import { APPLICABILITY_CONDITION } from '../models/applicability.model';

/** The elements a condition reads. */
const driversOf = (condition: ApplicabilityConditionSpec): readonly string[] =>
  condition.kind === APPLICABILITY_CONDITION.ANY_ROW_ANSWERED ? condition.elementKeys : [condition.elementKey];

/**
 * The fields on a step whose answer decides another field on the same step (task 80.1; §12.5.6's task-80.1 row) — a
 * follow-on's question: C7's incident yes/no, B4's *publicly available*, B1's legal form.
 *
 * **What makes a follow-on appear as the reporter answers.** S-07 lays acknowledged writes over the step it read rather
 * than reading it again, so a verdict over an answer on the same step would trail the answer; the browser reads the step
 * again once one of these is stored, and the verdict stays the api's, one evaluation and one place. A rule over a driver
 * on another step — B1's headcount for B8, B2's target for C2 — needs none: that step is left, and this one read, in
 * between.
 *
 * Pure: the rules and the step's elements are handed in.
 */
export function stepDrivers(input: {
  readonly rules: readonly ApplicabilityRule[];
  /** The element keys this step presents. */
  readonly onStep: ReadonlySet<string>;
}): ReadonlySet<string> {
  const driving = new Set<string>();
  for (const rule of input.rules) {
    if (!rule.elements.some((element) => input.onStep.has(element))) continue;
    for (const driver of driversOf(rule.condition)) if (input.onStep.has(driver)) driving.add(driver);
  }
  return driving;
}
