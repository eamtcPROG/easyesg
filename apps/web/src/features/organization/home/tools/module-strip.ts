import type { DisclosureModuleSummary, ReportScope } from '@easyesg/contracts';
import { WIZARD_STEP_STATE, type WizardStepState } from '@easyesg/ui';
import { moduleStateOf, modulesInScope, type ModuleChecks } from '@/features/wizard/tools/module-state';

/**
 * The resume card's strip of modules, B1 … B11 (or B1 … C9 for a Comprehensive report) — `EasyESG Workspace.dc.html`'s
 * S-05 artboard (task 255).
 *
 * **Every state is S-07's, through S-07's own rule.** `moduleStateOf` decides what each module is on the wizard's list,
 * and the strip calls it rather than restating it: a module needing a fix on the home and complete on the list would
 * be the two screens disagreeing about one fact. The calculator reads `features/wizard/tools/` the same way, which is
 * why the rule stays where it is rather than moving for a second reader. The artboard's fifth legend entry, *answered
 * as not material*, is the wizard's *omitted* — UX-29's third value, which VSME does not admit on materiality grounds,
 * so the words are the product's and not the artboard's.
 */
export interface StripModule {
  /** The standard's own reference — `B1`, `C3` — which is what the strip prints. */
  readonly module: string;
  readonly state: WizardStepState;
  /** Where work stopped (`resumeModule`), which the strip rings as the artboard rings B8. */
  readonly current: boolean;
}

/** The modules the report asks, in the standard's order, each with its state and whether work stopped there. */
export const moduleStrip = (input: {
  readonly modules: readonly DisclosureModuleSummary[];
  readonly checks: ModuleChecks;
  readonly scope: ReportScope;
  readonly current: string | undefined;
}): readonly StripModule[] =>
  modulesInScope({ modules: input.modules, scope: input.scope }).map((summary) => ({
    module: summary.module,
    state: moduleStateOf({ summary, checks: input.checks }),
    current: summary.module === input.current,
  }));

/**
 * The legend's order — **settled work first, then what needs doing, then what asks nothing** — the artboard's own
 * sequence with the wizard's two extra states placed where they read: *not checked yet* beside *complete*, since both
 * hold answers, and the two that ask nothing last.
 */
const LEGEND_ORDER: readonly WizardStepState[] = [
  WIZARD_STEP_STATE.COMPLETE,
  WIZARD_STEP_STATE.UNCHECKED,
  WIZARD_STEP_STATE.IN_PROGRESS,
  WIZARD_STEP_STATE.OMITTED,
  WIZARD_STEP_STATE.NOT_STARTED,
  WIZARD_STEP_STATE.WAITING,
  WIZARD_STEP_STATE.INAPPLICABLE,
];

/**
 * The states the legend explains: **only those the strip actually shows.** The artboard draws all five because its
 * report holds all five; a new report is eleven modules not started, and a legend explaining four colours nobody can
 * see is noise above the one action that matters.
 */
export const legendStates = (strip: readonly StripModule[]): readonly WizardStepState[] =>
  LEGEND_ORDER.filter((state) => strip.some((entry) => entry.state === state));

/**
 * Whether anything in the report is answered — the difference between *you stopped in B8* and *it starts with B1*.
 * `resumeModule` answers the module either way; this is what decides which sentence names it.
 */
export const hasAnswers = (modules: readonly DisclosureModuleSummary[]): boolean =>
  modules.some((summary) => summary.lastAnsweredAt !== null);
