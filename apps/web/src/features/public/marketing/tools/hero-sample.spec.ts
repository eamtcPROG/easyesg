import { WIZARD_STEP_STATE } from '@easyesg/ui';
import { describe, expect, it } from 'vitest';
import { BASIC_MODULES } from './basic-modules';
import { HERO_SAMPLE_STEPS, sampleRollUp } from './hero-sample';

/**
 * The hero's sample report: a rail in the wizard's real order with one step open, and a roll-up counted from the rows
 * rather than typed beside them.
 */
describe('the hero’s sample report', () => {
  it('lists every section once, in the report’s order, with exactly one open', () => {
    expect(HERO_SAMPLE_STEPS.map((step) => step.code)).toEqual([...BASIC_MODULES]);
    expect(HERO_SAMPLE_STEPS.filter((step) => step.current)).toHaveLength(1);
  });

  it('gives every step in progress a count of what is left, and no other step one', () => {
    for (const step of HERO_SAMPLE_STEPS) {
      expect(step.outstanding !== undefined, step.code).toBe(step.state === WIZARD_STEP_STATE.IN_PROGRESS);
    }
  });

  it('counts the complete steps of all of them', () => {
    expect(sampleRollUp(HERO_SAMPLE_STEPS)).toEqual({ done: 7, total: 11 });
    expect(
      sampleRollUp([
        { code: 'B1', state: WIZARD_STEP_STATE.COMPLETE },
        { code: 'B2', state: WIZARD_STEP_STATE.OMITTED },
      ]),
    ).toEqual({ done: 1, total: 2 });
  });
});
