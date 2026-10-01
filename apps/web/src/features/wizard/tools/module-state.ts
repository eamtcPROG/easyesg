import { REPORT_SCOPE, type DisclosureModuleSummary, type ReportScope } from '@easyesg/contracts';
import { WIZARD_STEP_STATE, type WizardStepState } from '@easyesg/ui';

/**
 * Where each module stands, and what the rail's roll-up says about a group of them (task 179.1) — pure, so the six
 * states and the count are unit specs rather than a browser journey that has to contrive a report in each state.
 *
 * **The Reporting Core rail's states are read off what the api already sends**, and the order they are read in is a
 * decision (`architecture.md` §12.5.6's task-179.1 row):
 *
 * - **Omitted is read first**, before applicability (task 36.13's order, kept): a reporter who has declared a module
 *   withheld has said something, and a rule that later rules it out must not replace their statement with the
 *   platform's.
 * - **Not applicable splits in two on the cause's answer.** `answer` is null exactly when the deciding B1 answer is
 *   absent — a threshold nobody has answered, or no site listed — so the module is *waiting* on B1 (UX-9) rather than
 *   ruled out; with an answer to quote, B1 has ruled it out (FR-28).
 * - **Complete, in progress and not started** follow the counts, which count the applicable fields only.
 *
 * The artboard's *In progress · n findings* is a validation verdict (task 42) and is not derived here.
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
 * The letter a Comprehensive Module reference begins with — the standard's own naming, B for the Basic Module and C for
 * the Comprehensive. Declared once, for the two rules below that read it.
 */
const COMPREHENSIVE_LETTER = 'C';

const isComprehensive = (summary: DisclosureModuleSummary): boolean =>
  summary.module.startsWith(COMPREHENSIVE_LETTER);

/**
 * The modules a report of this scope asks (task 179.3; FR-177, UX-9, `design_spec.md` S-07): a Basic report the
 * eleven, one whose scope carries the Comprehensive Module all twenty. **The wizard's one list**: the rail, the
 * stepper, the heading's position and the foot's way on all read it, so none can count a module the scope does not
 * ask. The api serves every module of the pinned taxonomy whatever the scope, which is why the cut is here.
 */
export function modulesInScope(input: {
  readonly modules: readonly DisclosureModuleSummary[];
  readonly scope: ReportScope;
}): readonly DisclosureModuleSummary[] {
  return input.scope === REPORT_SCOPE.BASIC_AND_COMPREHENSIVE
    ? input.modules
    : input.modules.filter((summary) => !isComprehensive(summary));
}

/**
 * The modules by group, each in the order the api sent them — the taxonomy's own — split by the reference's letter.
 * A group with no modules is not returned, so a Basic-only report draws one group.
 */
export function moduleGroups(
  modules: readonly DisclosureModuleSummary[],
): readonly { readonly group: ModuleGroup; readonly modules: readonly DisclosureModuleSummary[] }[] {
  const basic = modules.filter((summary) => !isComprehensive(summary));
  const comprehensive = modules.filter(isComprehensive);
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
 * The rail's *5 of 10 done* and its sentence. **A legitimate exclusion never lowers the figure**: an omitted module
 * leaves the count (UX-21), and so does one B1 has ruled out (`architecture.md` §12.5.6's task-91.3 row — a company
 * that can never fill B6 is not shown a denominator it cannot reach), where a waiting module stays in it — it will be
 * asked. Counted in the browser meanwhile, until task 41.3's server-side status replaces it (§12.5.6's task-179.1
 * row).
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
