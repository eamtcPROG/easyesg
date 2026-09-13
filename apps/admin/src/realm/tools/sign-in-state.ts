import type { ApiFailure } from '@easyesg/contracts';

/**
 * A-01's handshake as one value and the events that move it (UC-68, FR-75).
 *
 * **`step` and `failure` were two `useState`s and are one state** (26 Aug 2026, project owner's
 * rule for both front ends). Every handler wrote both: advancing cleared the failure and set the
 * step, a lapsed challenge set the step and then set the failure, restarting set both. Three call
 * sites spelling out one transition each, with the reader left to reconstruct what actually
 * happens on each event.
 *
 * Writing the whole next state is what makes the lapsed-challenge branch legible: it returns to
 * the credential step **and keeps the refusal**, so the api's own explanation is what greets the
 * reader there. As two setters that was a `setStep` inside an `if` followed by an unconditional
 * `setFailure`, which is the same behaviour and reads like a fall-through.
 *
 * **Pure, and in its own module since task 135** (`pure-logic-leaves-the-component`), for
 * `apps/web`'s `factor-state.ts` reason: the transitions are a unit spec, including the lapsed
 * challenge a browser journey reaches only by waiting five minutes. It lived unexported inside
 * `sign-in-screen.tsx` until then, where nothing could test a transition without rendering the
 * screen.
 */

export const STEP = {
  Credential: 'credential',
  Factor: 'factor',
} as const;

export type SignInStep =
  | { readonly kind: typeof STEP.Credential }
  | { readonly kind: typeof STEP.Factor; readonly email: string };

export interface SignInState {
  readonly step: SignInStep;
  readonly failure: ApiFailure | null;
}

export const SIGN_IN_EVENT = {
  /** The credential was accepted: a sealed challenge is open for this address. */
  CHALLENGE_OPENED: 'challenge_opened',
  /** The api refused, at whichever step asked. */
  REFUSED: 'refused',
  /** The five-minute challenge lapsed (§12.5.6), so the flow starts again from the credential. */
  CHALLENGE_LAPSED: 'challenge_lapsed',
  /** "Use another account" — the reader chose to start over. */
  RESTARTED: 'restarted',
  /**
   * A step's form left for the server. The previous refusal goes with it: a stale "wrong code"
   * above a submission that is still running says something untrue about the attempt in flight.
   */
  SUBMITTED: 'submitted',
} as const;

export type SignInEvent =
  | { readonly type: typeof SIGN_IN_EVENT.CHALLENGE_OPENED; readonly email: string }
  | { readonly type: typeof SIGN_IN_EVENT.REFUSED; readonly failure: ApiFailure }
  | { readonly type: typeof SIGN_IN_EVENT.CHALLENGE_LAPSED; readonly failure: ApiFailure }
  | { readonly type: typeof SIGN_IN_EVENT.RESTARTED }
  | { readonly type: typeof SIGN_IN_EVENT.SUBMITTED };

export const INITIAL_SIGN_IN_STATE: SignInState = {
  step: { kind: STEP.Credential },
  failure: null,
};

export function signInReducer(state: SignInState, event: SignInEvent): SignInState {
  switch (event.type) {
    case SIGN_IN_EVENT.CHALLENGE_OPENED:
      return { step: { kind: STEP.Factor, email: event.email }, failure: null };

    case SIGN_IN_EVENT.REFUSED:
      // The step is deliberately untouched: a wrong code must leave the reader on the factor
      // screen with the challenge still open, which is what the retype needs.
      return { ...state, failure: event.failure };

    case SIGN_IN_EVENT.CHALLENGE_LAPSED:
      return { step: { kind: STEP.Credential }, failure: event.failure };

    case SIGN_IN_EVENT.SUBMITTED:
      return { ...state, failure: null };

    // Named rather than the `default` it was inside the component, so a sixth event added to the
    // union without a branch is a type error here instead of a silent restart.
    case SIGN_IN_EVENT.RESTARTED:
      return INITIAL_SIGN_IN_STATE;
  }
}
