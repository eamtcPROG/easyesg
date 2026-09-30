import type { DisclosureModuleSummary } from '@easyesg/contracts';
import { WIZARD_STEP_STATE, type WizardStepState } from '@easyesg/ui';

/**
 * Where each module stands, and what the rail's roll-up says about a group of them (task 179.1) — pure, so the six
 * states and the count are unit specs rather than a browser journey that has to contrive a report in each state.
 *
 * **Five of the Reporting Core rail's states are read off what the api already sends**, and the order they are read in
 * is a decision:
 *
 * - **Omitted is read first**, before applicability (task 36.13's order, kept): a reporter who has declared a module
 *   withheld has said something, and a rule that later rules it out must not replace their statement with the
 *   platform's.
 * - **Not applicable splits in two on the cause's answer.** `answer` is null exactly when the deciding B1 answer is
 *   absent — a threshold nobody has answered, or no site listed — so the module is *waiting* on B1 (UX-9) rather than
 *   ruled out; with an answer to quote, B1 has ruled it out (FR-28).
 * - **Complete, in progress and not started** follow the counts, which count the applicable fields only.
 *
 * The artboard's sixth, *In progress · n findings*, is a validation verdict (task 42) and is not derived here.
 */
export function moduleStateOf(summary: DisclosureModuleSummary): WizardStepState {
  if (summary.omitted) return WIZARD_STEP_STATE.OMITTED;
  if (!summary.applicable) {
    return summary.applicabilityCause !== null && summary.applicabilityCause.answer === null
      ? WIZARD_STEP_STATE.WAITING
      : WIZARD_STEP_STATE.INAPPLICABLE;
  }
  if (summary.total > 0 && summary.answered >= summary.total) return WIZARD_STEP_STATE.COMPLETE;
  return summary.answered > 0 ? WIZARD_STEP_STATE.IN_PROGRESS : WIZARD_STEP_STATE.NOT_STARTED;
}

/** The two groups the rail draws — the Basic Module, and the Comprehensive Module where the scope carries it. */
export const MODULE_GROUP = { BASIC: 'basic', COMPREHENSIVE: 'comprehensive' } as const;

export type ModuleGroup = (typeof MODULE_GROUP)[keyof typeof MODULE_GROUP];

/**
 * The modules by group, each in the order the api sent them — the taxonomy's own. **By the reference's letter**, the
 * standard's own naming: B for the Basic Module, C for the Comprehensive. A group with no modules is not returned, so a
 * Basic-only report draws one group.
 */
export function moduleGroups(
  modules: readonly DisclosureModuleSummary[],
): readonly { readonly group: ModuleGroup; readonly modules: readonly DisclosureModuleSummary[] }[] {
  const basic = modules.filter((summary) => !summary.module.startsWith('C'));
  const comprehensive = modules.filter((summary) => summary.module.startsWith('C'));
  return [
    { group: MODULE_GROUP.BASIC, modules: basic },
    { group: MODULE_GROUP.COMPREHENSIVE, modules: comprehensive },
  ].filter((entry) => entry.modules.length > 0);
}

export interface ModuleRollUp {
  /** Modules complete. */
  readonly done: number;
  /** Modules the count is out of — every one but those discounted. */
  readonly counted: number;
  /** References discounted from the count: omitted, or ruled out (UX-21). */
  readonly discounted: readonly string[];
  /** References waiting on B1's answers — still counted, since they will be asked. */
  readonly waiting: readonly string[];
}

/**
 * The rail's *5 of 10 done* and its sentence. **A legitimate exclusion never lowers the figure** (UX-21): an omitted
 * module and one B1 has ruled out leave the count altogether, where a waiting module stays in it — it will be asked.
 */
export function rollUp(modules: readonly DisclosureModuleSummary[]): ModuleRollUp {
  const states = modules.map((summary) => ({ reference: summary.module, state: moduleStateOf(summary) }));
  const discounted = states
    .filter(({ state }) => state === WIZARD_STEP_STATE.OMITTED || state === WIZARD_STEP_STATE.INAPPLICABLE)
    .map(({ reference }) => reference);

  return {
    done: states.filter(({ state }) => state === WIZARD_STEP_STATE.COMPLETE).length,
    counted: states.length - discounted.length,
    discounted,
    waiting: states.filter(({ state }) => state === WIZARD_STEP_STATE.WAITING).map(({ reference }) => reference),
  };
}
