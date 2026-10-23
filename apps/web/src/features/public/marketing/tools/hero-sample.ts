import { WIZARD_STEP_STATE, type WizardStepState } from '@easyesg/ui';
import { BASIC_MODULES, type BasicModule } from './basic-modules';

/**
 * The report the hero's fragment shows — S-29's *"real interface fragments stand in for imagery"*: the wizard's own
 * step list drawn over a report part-way through, so a visitor sees every state a section can be in before signing up.
 *
 * **Sample data, and nothing reads it but the fragment.** It is here rather than in the component because the roll-up
 * the step list's heading states — how many sections are done — is derived from these rows, and a count typed beside
 * them is the kind that falls out of step the first time someone changes a row.
 */
export interface SampleStep {
  readonly code: BasicModule;
  readonly state: WizardStepState;
  /** Questions still to answer, for a step in progress. */
  readonly outstanding?: number;
  /** The step the fragment shows open. */
  readonly current?: boolean;
}

const STATE_OF: Readonly<Record<BasicModule, Omit<SampleStep, 'code'>>> = {
  B1: { state: WIZARD_STEP_STATE.COMPLETE },
  B2: { state: WIZARD_STEP_STATE.COMPLETE },
  B3: { state: WIZARD_STEP_STATE.IN_PROGRESS, outstanding: 2, current: true },
  B4: { state: WIZARD_STEP_STATE.INAPPLICABLE },
  B5: { state: WIZARD_STEP_STATE.COMPLETE },
  B6: { state: WIZARD_STEP_STATE.OMITTED },
  B7: { state: WIZARD_STEP_STATE.COMPLETE },
  B8: { state: WIZARD_STEP_STATE.IN_PROGRESS, outstanding: 4 },
  B9: { state: WIZARD_STEP_STATE.COMPLETE },
  B10: { state: WIZARD_STEP_STATE.COMPLETE },
  B11: { state: WIZARD_STEP_STATE.COMPLETE },
};

export const HERO_SAMPLE_STEPS: readonly SampleStep[] = BASIC_MODULES.map((code) => ({ code, ...STATE_OF[code] }));

/** The step list's roll-up: how many of the steps are complete, of how many. */
export function sampleRollUp(steps: readonly SampleStep[]): { readonly done: number; readonly total: number } {
  return {
    done: steps.filter((step) => step.state === WIZARD_STEP_STATE.COMPLETE).length,
    total: steps.length,
  };
}
