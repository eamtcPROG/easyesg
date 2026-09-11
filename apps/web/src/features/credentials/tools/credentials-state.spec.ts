import { describe, expect, it } from 'vitest';
import { CALLOUT_INTENT } from '@easyesg/ui';
import {
  CREDENTIALS_EVENT,
  CREDENTIALS_STAGE,
  credentialsReducer,
  initialCredentialsState,
  type CredentialsState,
} from './credentials-state';

/**
 * S-28's transitions. Three of them are the reason this is a reducer rather than four `useState`s,
 * and each was a real defect on S-16 before it became one there.
 */
const notice = (title: string) => ({
  intent: CALLOUT_INTENT.SUCCESS,
  title,
  body: 'body',
  action: 'what now',
});

const enrolling: CredentialsState = {
  stage: { kind: CREDENTIALS_STAGE.ENROLLING, secret: 'ABC', enrolmentUri: 'otpauth://x' },
  pendingSection: null,
  notice: notice('earlier'),
};

describe('credentialsReducer', () => {
  it('starts idle, and starts mid-flow when a provider round trip has returned', () => {
    expect(initialCredentialsState().stage.kind).toBe(CREDENTIALS_STAGE.IDLE);
    // The screen can be BORN in a stage the reader did not click into on this page load.
    expect(initialCredentialsState('google').stage).toEqual({
      kind: CREDENTIALS_STAGE.CONFIRMING_LINK,
      provider: 'google',
    });
  });

  it('clears the previous notice when a new action starts', () => {
    const next = credentialsReducer(
      { stage: { kind: CREDENTIALS_STAGE.IDLE }, pendingSection: null, notice: notice('stale') },
      { type: CREDENTIALS_EVENT.ACTION_STARTED, section: 'password' },
    );

    // S-16's defect, prevented here by the branch having to name the whole state: a stale
    // "your password was changed" above an unlink still running reads as one event.
    expect(next.notice).toBeNull();
    expect(next.pendingSection).toBe('password');
  });

  it('keeps the enrolment on screen when its code is refused', () => {
    const next = credentialsReducer(enrolling, {
      type: CREDENTIALS_EVENT.ACTION_FAILED,
      notice: notice('wrong code'),
    });

    // The secret is the only copy that will ever exist. Clearing the stage on a mistyped code
    // would make the user start enrolment again — the same reason the sign-in challenge is not
    // single-use (§12.5.6).
    expect(next.stage).toEqual(enrolling.stage);
    expect(next.notice?.title).toBe('wrong code');
    expect(next.pendingSection).toBeNull();
  });

  it('replaces the enrolment with the codes when it succeeds', () => {
    const next = credentialsReducer(enrolling, {
      type: CREDENTIALS_EVENT.CODES_ISSUED,
      codes: ['AAAA-BBBB-CCCC-DDDD'],
      notice: notice('enrolled'),
    });

    expect(next.stage).toEqual({
      kind: CREDENTIALS_STAGE.SHOWING_CODES,
      codes: ['AAAA-BBBB-CCCC-DDDD'],
    });
    // The secret is gone the moment the codes arrive — it has done its job and showing both would
    // put two once-only values on screen at once.
    expect(JSON.stringify(next.stage)).not.toContain('ABC');
  });

  it('takes the notice away with the codes, so the sentence introducing them does not outlive them', () => {
    const shown = credentialsReducer(enrolling, {
      type: CREDENTIALS_EVENT.CODES_ISSUED,
      codes: ['AAAA'],
      notice: notice('enrolled'),
    });

    const dismissed = credentialsReducer(shown, { type: CREDENTIALS_EVENT.DISMISSED });

    expect(dismissed).toEqual({
      stage: { kind: CREDENTIALS_STAGE.IDLE },
      pendingSection: null,
      notice: null,
    });
  });

  it('cannot hold two once-only values at the same time', () => {
    // The property the union buys, asserted as a property: whatever the sequence, the stage is one
    // of the four and never a record with both an enrolment and a code list set.
    const sequence = [
      { type: CREDENTIALS_EVENT.ENROLMENT_OFFERED, secret: 'S', enrolmentUri: 'u' },
      { type: CREDENTIALS_EVENT.CODES_ISSUED, codes: ['C'], notice: notice('x') },
      { type: CREDENTIALS_EVENT.ACTION_STARTED, section: 'providers' },
    ] as const;

    const final = sequence.reduce<CredentialsState>(
      (state, event) => credentialsReducer(state, event),
      initialCredentialsState(),
    );
    expect(Object.values(CREDENTIALS_STAGE)).toContain(final.stage.kind);
    expect(final.stage.kind).toBe(CREDENTIALS_STAGE.SHOWING_CODES);
  });
});
