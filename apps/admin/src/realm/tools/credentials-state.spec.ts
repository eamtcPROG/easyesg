import { describe, expect, it } from 'vitest';
import type { ApiFailure } from '@easyesg/contracts';
import {
  CREDENTIALS_EVENT,
  CREDENTIALS_NOTICE,
  CREDENTIALS_SECTION,
  credentialsReducer,
  initialCredentialsState,
  noticeSection,
  reauthenticationOutlives,
  type CredentialsState,
} from './credentials-state';

/**
 * A-19's transitions (task 151). Kinds and sections are asserted as literals on purpose — the root
 * file's test exception: they are what a renamed value must break.
 */
const refusal: ApiFailure = {
  status: 'problem',
  problem: { type: 'https://easyesg.md/problems/credential-invalid', status: 403, title: 'x', detail: 'y' },
};
const offer = { secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/easyesg:ana?secret=JBSWY3DPEHPK3PXP' };
const rest = initialCredentialsState(undefined);
const enrolling: CredentialsState = { ...rest, enrolment: offer };

describe('credentialsReducer (A-19, UC-212)', () => {
  it('is born with the arrival notice when A-01’s recovery sent the operator here, and with none otherwise', () => {
    expect(initialCredentialsState('recovered')).toEqual({
      enrolment: null,
      codes: null,
      pending: null,
      notice: { kind: 'recovered' },
    });
    expect(rest).toEqual({ enrolment: null, codes: null, pending: null, notice: null });
  });

  it('retires any notice when a write starts, the arrival notice included', () => {
    expect(
      credentialsReducer(initialCredentialsState('recovered'), {
        type: CREDENTIALS_EVENT.ACTION_STARTED,
        section: CREDENTIALS_SECTION.PASSWORD,
      }),
    ).toEqual({ enrolment: null, codes: null, pending: 'password', notice: null });
  });

  it('places a refusal in the section that was acting, and keeps an open enrolment to retype against', () => {
    const acting = credentialsReducer(enrolling, {
      type: CREDENTIALS_EVENT.ACTION_STARTED,
      section: CREDENTIALS_SECTION.FACTOR,
    });
    expect(credentialsReducer(acting, { type: CREDENTIALS_EVENT.ACTION_REFUSED, failure: refusal })).toEqual({
      enrolment: offer,
      codes: null,
      pending: null,
      notice: { kind: 'refused', section: 'factor', failure: refusal },
    });
  });

  it('has nothing to place when a refusal arrives with nothing acting', () => {
    expect(credentialsReducer(rest, { type: CREDENTIALS_EVENT.ACTION_REFUSED, failure: refusal })).toBe(rest);
  });

  it('keeps a staged enrolment through a password change, and says how many other sessions ended', () => {
    expect(
      credentialsReducer(
        { ...enrolling, pending: CREDENTIALS_SECTION.PASSWORD },
        { type: CREDENTIALS_EVENT.PASSWORD_CHANGED, otherSessionsTerminated: 2 },
      ),
    ).toEqual({
      enrolment: offer,
      codes: null,
      pending: null,
      notice: { kind: 'password_changed', otherSessionsTerminated: 2 },
    });
  });

  it('opens an enrolment on the offer and closes it on the confirmation, with its notice', () => {
    const offered = credentialsReducer(
      { ...rest, pending: CREDENTIALS_SECTION.FACTOR },
      { type: CREDENTIALS_EVENT.ENROLMENT_OFFERED, offer },
    );
    expect(offered).toEqual({ enrolment: offer, codes: null, pending: null, notice: null });
    expect(
      credentialsReducer(
        { ...offered, pending: CREDENTIALS_SECTION.FACTOR },
        { type: CREDENTIALS_EVENT.FACTOR_REPLACED },
      ),
    ).toEqual({ enrolment: null, codes: null, pending: null, notice: { kind: 'factor_replaced' } });
  });

  it('takes the factor section’s refusal with an abandoned enrolment, and leaves another section’s notice', () => {
    const refusedHere: CredentialsState = {
      ...enrolling,
      notice: { kind: CREDENTIALS_NOTICE.REFUSED, section: CREDENTIALS_SECTION.FACTOR, failure: refusal },
    };
    expect(credentialsReducer(refusedHere, { type: CREDENTIALS_EVENT.ENROLMENT_ABANDONED })).toEqual(rest);

    const changedElsewhere: CredentialsState = {
      ...enrolling,
      notice: { kind: CREDENTIALS_NOTICE.PASSWORD_CHANGED, otherSessionsTerminated: 0 },
    };
    expect(credentialsReducer(changedElsewhere, { type: CREDENTIALS_EVENT.ENROLMENT_ABANDONED })).toEqual({
      ...rest,
      notice: { kind: 'password_changed', otherSessionsTerminated: 0 },
    });
  });

  it('shows issued codes beside an open enrolment — the secret is not lost — until they are acknowledged', () => {
    const issued = credentialsReducer(
      { ...enrolling, pending: CREDENTIALS_SECTION.RECOVERY_CODES },
      { type: CREDENTIALS_EVENT.CODES_ISSUED, codes: ['AAAA-BBBB-CCCC-DDDD'] },
    );
    expect(issued).toEqual({ enrolment: offer, codes: ['AAAA-BBBB-CCCC-DDDD'], pending: null, notice: null });
    expect(credentialsReducer(issued, { type: CREDENTIALS_EVENT.CODES_ACKNOWLEDGED })).toEqual(enrolling);
  });
});

describe('noticeSection', () => {
  it('draws the arrival notice above the sections and every other notice in its own', () => {
    expect(noticeSection({ kind: CREDENTIALS_NOTICE.RECOVERED })).toBeNull();
    expect(noticeSection({ kind: CREDENTIALS_NOTICE.PASSWORD_CHANGED, otherSessionsTerminated: 0 })).toBe('password');
    expect(noticeSection({ kind: CREDENTIALS_NOTICE.FACTOR_REPLACED })).toBe('factor');
    expect(
      noticeSection({
        kind: CREDENTIALS_NOTICE.REFUSED,
        section: CREDENTIALS_SECTION.RECOVERY_CODES,
        failure: refusal,
      }),
    ).toBe('recovery-codes');
  });
});

describe('reauthenticationOutlives', () => {
  it('keeps the password while an enrolment is open after the event', () => {
    expect(reauthenticationOutlives(rest, { type: CREDENTIALS_EVENT.ENROLMENT_OFFERED, offer })).toBe(true);
    expect(
      reauthenticationOutlives(
        { ...enrolling, pending: CREDENTIALS_SECTION.FACTOR },
        { type: CREDENTIALS_EVENT.ACTION_REFUSED, failure: refusal },
      ),
    ).toBe(true);
    expect(
      reauthenticationOutlives(
        { ...enrolling, pending: CREDENTIALS_SECTION.RECOVERY_CODES },
        { type: CREDENTIALS_EVENT.CODES_ISSUED, codes: ['AAAA-BBBB-CCCC-DDDD'] },
      ),
    ).toBe(true);
  });

  it('spends it once no enrolment is open', () => {
    expect(
      reauthenticationOutlives(
        { ...rest, pending: CREDENTIALS_SECTION.FACTOR },
        { type: CREDENTIALS_EVENT.ACTION_REFUSED, failure: refusal },
      ),
    ).toBe(false);
    expect(
      reauthenticationOutlives(
        { ...enrolling, pending: CREDENTIALS_SECTION.FACTOR },
        { type: CREDENTIALS_EVENT.FACTOR_REPLACED },
      ),
    ).toBe(false);
    expect(reauthenticationOutlives(enrolling, { type: CREDENTIALS_EVENT.ENROLMENT_ABANDONED })).toBe(false);
    expect(
      reauthenticationOutlives(
        { ...rest, pending: CREDENTIALS_SECTION.RECOVERY_CODES },
        { type: CREDENTIALS_EVENT.CODES_ISSUED, codes: ['AAAA-BBBB-CCCC-DDDD'] },
      ),
    ).toBe(false);
  });

  it('spends it on a password change even with an enrolment open — the field holds the old password', () => {
    expect(
      reauthenticationOutlives(
        { ...enrolling, pending: CREDENTIALS_SECTION.PASSWORD },
        { type: CREDENTIALS_EVENT.PASSWORD_CHANGED, otherSessionsTerminated: 0 },
      ),
    ).toBe(false);
  });
});
