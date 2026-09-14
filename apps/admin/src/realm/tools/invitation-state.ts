import type { AdminEnrolment, ApiFailure } from '@easyesg/contracts';

/**
 * A-20's steps (task 67.4) — the password, then the factor the account will be created with.
 *
 * **The password is held until the second step submits**, in memory and nowhere else: acceptance
 * takes both at once, because an account may not exist with one credential and not the other. Going
 * back to change it discards the staged offer from this state — the server keeps the same secret for
 * the link, so the next offer is the one already scanned.
 *
 * A reducer rather than `useState`s for `sign-in-state.ts`'s reason: a step, the value it carries and
 * the last refusal move together, and each event names the whole next state.
 */
export const INVITATION_STEP = {
  PASSWORD: 'password',
  ENROLMENT: 'enrolment',
} as const;

export type InvitationStep =
  | { readonly kind: typeof INVITATION_STEP.PASSWORD }
  | {
      readonly kind: typeof INVITATION_STEP.ENROLMENT;
      readonly password: string;
      readonly offer: AdminEnrolment;
    };

export interface InvitationState {
  readonly step: InvitationStep;
  readonly failure: ApiFailure | null;
}

export const INITIAL_INVITATION_STATE: InvitationState = {
  step: { kind: INVITATION_STEP.PASSWORD },
  failure: null,
};

export const INVITATION_EVENT = {
  SUBMITTED: 'submitted',
  ENROLMENT_OFFERED: 'enrolment_offered',
  REFUSED: 'refused',
  PASSWORD_REOPENED: 'password_reopened',
} as const;

export type InvitationEvent =
  | { readonly type: typeof INVITATION_EVENT.SUBMITTED }
  | {
      readonly type: typeof INVITATION_EVENT.ENROLMENT_OFFERED;
      readonly password: string;
      readonly offer: AdminEnrolment;
    }
  | { readonly type: typeof INVITATION_EVENT.REFUSED; readonly failure: ApiFailure }
  | { readonly type: typeof INVITATION_EVENT.PASSWORD_REOPENED };

export function invitationReducer(state: InvitationState, event: InvitationEvent): InvitationState {
  switch (event.type) {
    case INVITATION_EVENT.SUBMITTED:
      return { ...state, failure: null };

    case INVITATION_EVENT.ENROLMENT_OFFERED:
      return {
        step: { kind: INVITATION_STEP.ENROLMENT, password: event.password, offer: event.offer },
        failure: null,
      };

    case INVITATION_EVENT.REFUSED:
      // The step stays: a wrong code keeps the reader on the factor, a refused password on the password.
      return { ...state, failure: event.failure };

    case INVITATION_EVENT.PASSWORD_REOPENED:
      return INITIAL_INVITATION_STATE;
  }
}
