import { ACCOUNT_STATUS, type AccountSetup } from '@easyesg/contracts';

/**
 * Which of S-36's steps an account's setup is at (task 155; `design_spec.md` S-36).
 *
 * **Decided from what the API says the account holds, never from which step the reader last
 * submitted**, so a reload, a second tab, or a reset link that set the password somewhere else all
 * land on the step actually owed. An active account is complete whatever it holds — the answer a
 * screen left open after finishing needs, rather than a step it has no business showing.
 */
export const SETUP_STEP = {
  PASSWORD: 'password',
  PROFILE: 'profile',
  COMPLETE: 'complete',
} as const;

export type SetupStep = (typeof SETUP_STEP)[keyof typeof SETUP_STEP];

/** The steps' positions, for the "step n of m" line S-36's layout states. */
export const SETUP_STEP_POSITION = {
  [SETUP_STEP.PASSWORD]: 1,
  [SETUP_STEP.PROFILE]: 2,
} as const;

/** The "m" — derived from the positions, so a step added there is counted without a second edit. */
export const SETUP_STEP_COUNT = Object.keys(SETUP_STEP_POSITION).length;

export const setupStepOf = (setup: Pick<AccountSetup, 'status' | 'passwordSet'>): SetupStep => {
  if (setup.status === ACCOUNT_STATUS.ACTIVE) return SETUP_STEP.COMPLETE;
  return setup.passwordSet ? SETUP_STEP.PROFILE : SETUP_STEP.PASSWORD;
};
