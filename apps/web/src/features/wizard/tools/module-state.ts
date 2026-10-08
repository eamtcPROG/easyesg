import {
  COMPLETION_STATUS,
  REPORT_SCOPE,
  type CompletionStatus,
  type DisclosureModuleSummary,
  type ModuleRollUp,
  type ReportScope,
  type Validation,
} from '@easyesg/contracts';
import { WIZARD_STEP_STATE, type WizardStepState } from '@easyesg/ui';

/** A module as the last run left it, as the list reads it — its status and how many fields it left outstanding. */
export type ModuleCheck = Pick<ModuleRollUp, 'module' | 'status' | 'outstanding'>;

/**
 * What the last validation run found, module by module — the roll-up's modules (task 41.3), projected to what the list
 * reads — or `null` for a report never checked (task 42.2; `architecture.md` §12.5.6's task-42 row (3)). **Projected
 * because it crosses into the switcher**, a Client Component: the roll-up's outstanding fields are S-08's, and the
 * list would carry every address across the boundary for no reader (`server-serialization`).
 */
export type ModuleChecks = { readonly modules: readonly ModuleCheck[] } | null;

/**
 * The checks the validation read answered: its roll-up's modules, or `null` where the report was never checked — or
 * where the read failed, which the list then shows as it would a report never checked, and S-08 says it could not read.
 */
export const moduleChecksOf = (validation: Pick<Validation, 'rollUp'> | null): ModuleChecks =>
  validation?.rollUp
    ? {
        modules: validation.rollUp.modules.map(({ module, status, outstanding }) => ({ module, status, outstanding })),
      }
    : null;

/** The roll-up's status as the list's state — one table, so the list and the heading cannot word one status two ways. */
const STATE_OF_STATUS: Readonly<Record<CompletionStatus, WizardStepState>> = {
  [COMPLETION_STATUS.NOT_STARTED]: WIZARD_STEP_STATE.NOT_STARTED,
  [COMPLETION_STATUS.IN_PROGRESS]: WIZARD_STEP_STATE.IN_PROGRESS,
  [COMPLETION_STATUS.COMPLETE]: WIZARD_STEP_STATE.COMPLETE,
};

/** The last run's word on one module, or `undefined` where it said nothing — never checked, or not listed then. */
export const checkOf = (input: {
  readonly module: string;
  readonly checks: ModuleChecks;
}): ModuleCheck | undefined => input.checks?.modules.find((checked) => checked.module === input.module);

/**
 * Where each module stands (task 179.1, and since task 42.2 the server's roll-up) — pure, so the seven states are unit
 * specs rather than a browser journey that has to contrive a report in each state.
 *
 * **The order the states are read in is a decision** (`architecture.md` §12.5.6's task-179.1 and task-42 rows):
 *
 * - **Omitted is read first**, before applicability (task 36.13's order, kept): a reporter who has declared a module
 *   withheld has said something, and a rule that later rules it out must not replace their statement with the
 *   platform's.
 * - **Not applicable splits in two on the cause's answer.** `answer` is null exactly when the deciding B1 answer is
 *   absent — so the module is *waiting* on B1 (UX-9) rather than ruled out; with an answer to quote, B1 has ruled it
 *   out (FR-28).
 * - **Complete, in progress and not started are the last run's** (FR-41 AC-5; task-41 row (3)), as it left them
 *   (182/26) — the browser's own count from task 179.1 is gone, so the list and S-08 read one roll-up.
 * - **With no word from a run, a module with nothing answered is not started** — what a run would find, nothing being
 *   resolved or reasoned — **and any other is not checked yet** (task-42 row (3)): there are answers, and no count has
 *   been made of them.
 */
export function moduleStateOf(input: {
  readonly summary: DisclosureModuleSummary;
  readonly checks: ModuleChecks;
}): WizardStepState {
  const { summary } = input;
  if (summary.omitted) return WIZARD_STEP_STATE.OMITTED;
  if (!summary.applicable) {
    return summary.applicabilityCause !== null && summary.applicabilityCause.answer === null
      ? WIZARD_STEP_STATE.WAITING
      : WIZARD_STEP_STATE.INAPPLICABLE;
  }
  const checked = checkOf({ module: summary.module, checks: input.checks });
  if (checked !== undefined) return STATE_OF_STATUS[checked.status];
  return summary.answered === 0 ? WIZARD_STEP_STATE.NOT_STARTED : WIZARD_STEP_STATE.UNCHECKED;
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

export interface GroupCount {
  /** Modules the last run found complete. */
  readonly done: number;
  /** Modules the count is out of — every one but those discounted. */
  readonly counted: number;
  /** References discounted from the count: omitted, or ruled out (UX-21). */
  readonly discounted: readonly string[];
  /** References waiting on B1's answers — still counted, since they will be asked. */
  readonly waiting: readonly string[];
  /** Whether any run has checked the report — without one there is no count to state (task-42 row (3)). */
  readonly checked: boolean;
}

/**
 * The group's *5 of 10 done* and its sentence. **A legitimate exclusion never lowers the figure**: an omitted module
 * leaves the count (UX-21), and so does one B1 has ruled out (`architecture.md` §12.5.6's task-91.3 row — a company
 * that can never fill B6 is not shown a denominator it cannot reach), where a waiting module stays in it — it will be
 * asked. **Done is the last run's *complete*** since task 42.2, so the group's count and the list's marks are one
 * reading of one roll-up.
 */
export function groupCount(input: {
  readonly modules: readonly DisclosureModuleSummary[];
  readonly checks: ModuleChecks;
}): GroupCount {
  const states = input.modules.map((summary) => ({
    reference: summary.module,
    state: moduleStateOf({ summary, checks: input.checks }),
  }));
  const discounted = states
    .filter(({ state }) => state === WIZARD_STEP_STATE.OMITTED || state === WIZARD_STEP_STATE.INAPPLICABLE)
    .map(({ reference }) => reference);

  return {
    done: states.filter(({ state }) => state === WIZARD_STEP_STATE.COMPLETE).length,
    counted: states.length - discounted.length,
    discounted,
    waiting: states.filter(({ state }) => state === WIZARD_STEP_STATE.WAITING).map(({ reference }) => reference),
    checked: input.checks !== null,
  };
}
