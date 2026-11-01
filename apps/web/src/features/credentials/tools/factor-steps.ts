import { CODES_ORIGIN, CREDENTIALS_STAGE, type CredentialsStageValue } from './credentials-state';

/**
 * The second factor's flows as step sequences (task 169, the owner's review of the rebuilt S-28: *it should be in
 * steps*) — §4.2's *step sequence within a flow*, the contextual tier. No artboard draws the enrolment, so the steps
 * are the flow's own stages, named for what the reader does at each:
 *
 * - **Turning it on**: confirm it is you → add the key to an authenticator and answer its first code → save the
 *   recovery codes. Adding the key and answering its code are one step, because the code is the proof the key was
 *   captured (UC-193: *enrolment is not complete until a current code is returned*).
 * - **New recovery codes**: confirm it is you → save the codes.
 *
 * Turning the factor off is one confirmation, not a flow, and draws no steps.
 */
export const FACTOR_STEP = {
  CONFIRM: 'confirm',
  AUTHENTICATOR: 'authenticator',
  CODES: 'codes',
} as const;

export type FactorStepKey = (typeof FACTOR_STEP)[keyof typeof FACTOR_STEP];

export const FACTOR_FLOW = {
  ENROLMENT: 'enrolment',
  REISSUE: 'reissue',
} as const;

export type FactorFlow = (typeof FACTOR_FLOW)[keyof typeof FACTOR_FLOW];

export interface FactorSteps {
  readonly flow: FactorFlow;
  readonly steps: readonly FactorStepKey[];
  /** Index into `steps` of the one the reader is on. */
  readonly current: number;
}

const ENROLMENT_STEPS = [FACTOR_STEP.CONFIRM, FACTOR_STEP.AUTHENTICATOR, FACTOR_STEP.CODES] as const;
const REISSUE_STEPS = [FACTOR_STEP.CONFIRM, FACTOR_STEP.CODES] as const;

/** The sequence the open stage sits in, or null where the factor row draws no steps. */
export function factorSteps(stage: CredentialsStageValue): FactorSteps | null {
  switch (stage.kind) {
    case CREDENTIALS_STAGE.BEGINNING_ENROLMENT:
      return { flow: FACTOR_FLOW.ENROLMENT, steps: ENROLMENT_STEPS, current: 0 };
    case CREDENTIALS_STAGE.ENROLLING:
      return { flow: FACTOR_FLOW.ENROLMENT, steps: ENROLMENT_STEPS, current: 1 };
    case CREDENTIALS_STAGE.REISSUING_CODES:
      return { flow: FACTOR_FLOW.REISSUE, steps: REISSUE_STEPS, current: 0 };
    case CREDENTIALS_STAGE.SHOWING_CODES:
      return stage.origin === CODES_ORIGIN.ENROLMENT
        ? { flow: FACTOR_FLOW.ENROLMENT, steps: ENROLMENT_STEPS, current: 2 }
        : { flow: FACTOR_FLOW.REISSUE, steps: REISSUE_STEPS, current: 1 };
    default:
      return null;
  }
}
