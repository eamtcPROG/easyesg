import { elementsOf, evaluateRules, type FieldValue, type Finding, type RuleSet } from '@easyesg/validation';
import { findingKey } from './finding-key';

/**
 * **What the open step's fields show, and where each finding comes from** (task 42.1; FR-40 item 5, OQ-49, BR-VAL-1;
 * `architecture.md` §12.5.6's task-42 row (1)).
 *
 * - **Live**, for every rule the step can evaluate whole: the interpreter in the browser — the api's own, so the two
 *   cannot disagree (§9.8, task 40.3) — over the answers the wizard holds (`answersHeld`), the scope the api computed
 *   narrowed to the elements this step presents, and last year's comparable values.
 * - **As the last run found it**, for every other rule. A rule naming an element the step does not present — B8's
 *   split against B1's headcount, C8's revenues against turnover — is not evaluated here, by the interpreter's own
 *   scope rule (task-40 row (1)), and the run is the only thing that has read both sides.
 *
 * A rule is one or the other, never both, so a live answer replaces the run's word about the same rule rather than
 * sitting beside a stale copy of it — and a last-run finding a live answer no longer raises is reported as cleared, for
 * S-08 to keep in view (task 42.2). With no rules — the read failed or answered nothing the interpreter can hold — the
 * last run answers every rule, which is what the step showed before this task, minus nothing.
 */
export interface StepVerdicts {
  /** What the step's fields show: live where the step evaluates the rule, the last run's otherwise. */
  readonly findings: readonly Finding[];
  /**
   * The last run's findings the answers held now no longer raise — on a rule the step evaluates, by `findingKey` (task
   * 42.2; row (c)). S-08 keeps them in view as cleared since the last check rather than dropping them mid-keystroke.
   */
  readonly cleared: ReadonlySet<string>;
}

export function stepFindings(input: {
  /** The rules and the report's scope, or `null` where they could not be read. */
  readonly rules: { readonly ruleSet: RuleSet; readonly scope: readonly string[] } | null;
  /** The elements the open step presents. */
  readonly stepElements: ReadonlySet<string>;
  readonly values: readonly FieldValue[];
  /** Last year's comparable answers, for the year-over-year rule (FR-46). */
  readonly prior: readonly FieldValue[];
  /** The last run's findings, as the validation read answered them. */
  readonly lastRun: readonly Finding[];
}): StepVerdicts {
  if (input.rules === null) return { findings: input.lastRun, cleared: new Set() };
  const scope = new Set(input.rules.scope.filter((element) => input.stepElements.has(element)));
  const live = evaluateRules({ ruleSet: input.rules.ruleSet, scope, values: input.values, prior: input.prior });
  const evaluatedHere = new Set(
    input.rules.ruleSet.rules
      .filter((rule) => elementsOf(rule).every((element) => scope.has(element)))
      .map((rule) => rule.id),
  );
  const raised = new Set(live.map(findingKey));
  return {
    findings: [...live, ...input.lastRun.filter((finding) => !evaluatedHere.has(finding.rule))],
    cleared: new Set(
      input.lastRun
        .filter((finding) => evaluatedHere.has(finding.rule) && !raised.has(findingKey(finding)))
        .map(findingKey),
    ),
  };
}
