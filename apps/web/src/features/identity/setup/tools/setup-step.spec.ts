import { describe, expect, it } from 'vitest';
import { SETUP_STEP, setupStepOf } from './setup-step';

/** S-36's step, arm by arm (task 155) — every arm a line here rather than a browser journey. */
describe('setupStepOf (S-36)', () => {
  it('asks for the password while the account holds none', () => {
    expect(setupStepOf({ status: 'awaiting_setup', passwordSet: false })).toBe(SETUP_STEP.PASSWORD);
  });

  it('asks for the name and language once the password is held', () => {
    expect(setupStepOf({ status: 'awaiting_setup', passwordSet: true })).toBe(SETUP_STEP.PROFILE);
  });

  /** A reload after finishing, or a setup finished in another tab, must not draw a step. */
  it('is complete for an active account, whatever it holds', () => {
    expect(setupStepOf({ status: 'active', passwordSet: true })).toBe(SETUP_STEP.COMPLETE);
    expect(setupStepOf({ status: 'active', passwordSet: false })).toBe(SETUP_STEP.COMPLETE);
  });
});
