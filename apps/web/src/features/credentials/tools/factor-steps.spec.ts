import { describe, expect, it } from 'vitest';
import { CODES_ORIGIN, CREDENTIALS_STAGE } from './credentials-state';
import { FACTOR_FLOW, FACTOR_STEP, factorSteps } from './factor-steps';

/**
 * The second factor's step sequences (task 169). The case that matters most is the last step: the same codes screen
 * is step 3 of 3 after turning the factor on and step 2 of 2 after replacing spent codes, and only the stage's origin
 * can tell them apart.
 */
describe('factorSteps', () => {
  it('walks turning the factor on through three steps', () => {
    expect(factorSteps({ kind: CREDENTIALS_STAGE.BEGINNING_ENROLMENT })).toEqual({
      flow: FACTOR_FLOW.ENROLMENT,
      steps: [FACTOR_STEP.CONFIRM, FACTOR_STEP.AUTHENTICATOR, FACTOR_STEP.CODES],
      current: 0,
    });
    expect(factorSteps({ kind: CREDENTIALS_STAGE.ENROLLING, secret: 'S', enrolmentUri: 'u' })?.current).toBe(1);
    expect(
      factorSteps({ kind: CREDENTIALS_STAGE.SHOWING_CODES, codes: [], origin: CODES_ORIGIN.ENROLMENT }),
    ).toMatchObject({ flow: FACTOR_FLOW.ENROLMENT, current: 2 });
  });

  it('walks new recovery codes through two, ending on the same codes screen', () => {
    expect(factorSteps({ kind: CREDENTIALS_STAGE.REISSUING_CODES })).toEqual({
      flow: FACTOR_FLOW.REISSUE,
      steps: [FACTOR_STEP.CONFIRM, FACTOR_STEP.CODES],
      current: 0,
    });
    expect(
      factorSteps({ kind: CREDENTIALS_STAGE.SHOWING_CODES, codes: [], origin: CODES_ORIGIN.REISSUE }),
    ).toMatchObject({ flow: FACTOR_FLOW.REISSUE, current: 1 });
  });

  it('draws no steps for a single confirmation, or for another row', () => {
    expect(factorSteps({ kind: CREDENTIALS_STAGE.DISABLING_FACTOR })).toBeNull();
    expect(factorSteps({ kind: CREDENTIALS_STAGE.CHANGING_PASSWORD })).toBeNull();
    expect(factorSteps({ kind: CREDENTIALS_STAGE.IDLE })).toBeNull();
  });
});
