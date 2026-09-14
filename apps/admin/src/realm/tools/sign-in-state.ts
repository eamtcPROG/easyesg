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
 * **Three steps since task 151.** The recovery sign-in — the address, the password again and one
 * recovery code (UC-212) — is a step of this card rather than a screen of its own, with two ways in:
 * the factor step's link, carrying the address the challenge verified, and a lockout refusal on the
 * credential step, carrying the address that was refused. Both are one event, because what the step
 * needs from either is the same: an address to start from.
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
  Recovery: 'recovery',
} as const;

export type SignInStep =
  | { readonly kind: typeof STEP.Credential }
  | { readonly kind: typeof STEP.Factor; readonly email: string }
  /** The address is where the step's form starts, not a fact: the api judges what the form sends. */
  | { readonly kind: typeof STEP.Recovery; readonly email: string };

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
  /**
   * "Use a recovery code" — from the factor step, or from a lockout refusal on the credential step
   * (task 151). The refusal that offered it goes with it: it has been acted on.
   */
  RECOVERY_OPENED: 'recovery_opened',
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
  | { readonly type: typeof SIGN_IN_EVENT.RECOVERY_OPENED; readonly email: string }
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
      // screen with the challenge still open, which is what the retype needs — and a refused
      // recovery code leaves the reader on its step with the address and password still typed.
      return { ...state, failure: event.failure };

    case SIGN_IN_EVENT.CHALLENGE_LAPSED:
      return { step: { kind: STEP.Credential }, failure: event.failure };

    case SIGN_IN_EVENT.RECOVERY_OPENED:
      return { step: { kind: STEP.Recovery, email: event.email }, failure: null };

    case SIGN_IN_EVENT.SUBMITTED:
      return { ...state, failure: null };

    // Named rather than the `default` it was inside the component, so an event added to the union
    // without a branch is a type error here instead of a silent restart.
    case SIGN_IN_EVENT.RESTARTED:
      return INITIAL_SIGN_IN_STATE;
  }
}
