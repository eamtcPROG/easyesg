import { describe, expect, it } from 'vitest';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import {
  INITIAL_INVITATION_STATE,
  INVITATION_EVENT,
  invitationReducer,
} from './invitation-state';

const offer = { secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', uri: 'otpauth://totp/x' };
const wrongCode: ApiFailure = {
  status: API_OUTCOME.Problem,
  problem: { type: 'https://easyesg.md/problems/factor-invalid', status: 401 },
};

describe('A-20’s steps (task 67.4)', () => {
  it('moves to the factor carrying the password it will be accepted with', () => {
    expect(
      invitationReducer(INITIAL_INVITATION_STATE, {
        type: INVITATION_EVENT.ENROLMENT_OFFERED,
        password: 'Parola123!',
        offer,
      }),
    ).toEqual({ step: { kind: 'enrolment', password: 'Parola123!', offer }, failure: null });
  });

  it('keeps the reader on the factor after a wrong code, and a new submission clears the refusal', () => {
    const onFactor = invitationReducer(INITIAL_INVITATION_STATE, {
      type: INVITATION_EVENT.ENROLMENT_OFFERED,
      password: 'Parola123!',
      offer,
    });
    const refused = invitationReducer(onFactor, { type: INVITATION_EVENT.REFUSED, failure: wrongCode });

    expect(refused.step).toEqual(onFactor.step);
    expect(refused.failure).toBe(wrongCode);
    expect(invitationReducer(refused, { type: INVITATION_EVENT.SUBMITTED }).failure).toBeNull();
  });

  it('forgets the password when the reader goes back to change it', () => {
    const onFactor = invitationReducer(INITIAL_INVITATION_STATE, {
      type: INVITATION_EVENT.ENROLMENT_OFFERED,
      password: 'Parola123!',
      offer,
    });
    expect(invitationReducer(onFactor, { type: INVITATION_EVENT.PASSWORD_REOPENED })).toEqual(
      INITIAL_INVITATION_STATE,
    );
  });
});
