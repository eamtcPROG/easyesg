import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import {
  FACTOR_ANSWER,
  FACTOR_LAPSED,
  type CompleteFactorFailure,
  type FactorAnswerKind,
} from './factor';

/**
 * S-01's factor step as one value and the events that move it.
 *
 * **Two `useState`s would have been the defect the reducer rule names.** Switching from the
 * authenticator to a recovery code writes the affordance *and* clears the last refusal — two
 * different setters in one handler, which is the tell. Left as two, a *"that code was not
 * accepted"* callout would sit above a field the reader had just swapped to and never used, framing
 * the new attempt as though it had already failed. Here it is one line in one branch, and it is one
 * line **because** every branch has to name the whole next state.
 *
 * **Refused and lapsed are a union, not two fields.** They cannot both hold: a lapsed challenge
 * replaces the form outright — there is nothing left to retype into — where a refusal leaves it
 * standing. As two booleans the impossible pair is representable and every reader has to know not
 * to write it.
 *
 * Pure, and in its own module, for `access-state.ts`'s reason: the transitions are a unit spec,
 * including the one a browser journey cannot reach without waiting five minutes.
 */

export const FACTOR_STANDING = {
  /** Nothing has been refused — at rest, or in flight. */
  OPEN: 'open',
  /** The API said no: a wrong or spent code, the FR-4 lockout, the throttle, or no answer at all. */
  REFUSED: 'refused',
  /**
   * The five-minute window closed. Terminal on this screen: the challenge proves the password was
   * verified *just now*, so nothing here can revive it and the only way on is S-01.
   */
  LAPSED: 'lapsed',
} as const;

export type FactorStandingKind = (typeof FACTOR_STANDING)[keyof typeof FACTOR_STANDING];

export type FactorStanding =
  | { readonly kind: typeof FACTOR_STANDING.OPEN }
  | { readonly kind: typeof FACTOR_STANDING.REFUSED; readonly failure: ApiFailure }
  | { readonly kind: typeof FACTOR_STANDING.LAPSED };

export interface FactorState {
  /** Which control is showing. Presentation — the API takes one field for both (`factor.ts`). */
  readonly answer: FactorAnswerKind;
  readonly standing: FactorStanding;
}

export const INITIAL_FACTOR_STATE: FactorState = {
  answer: FACTOR_ANSWER.AUTHENTICATOR,
  standing: { kind: FACTOR_STANDING.OPEN },
};

/** Named for what happened, never for the field written — `SET_STANDING` would be the two
 *  `useState`s again in a reducer's clothes. */
export const FACTOR_EVENT = {
  /** The reader chose the other way of answering. */
  ANSWER_CHOSEN: 'answer_chosen',
  /** A code left for the server. */
  SUBMITTED: 'submitted',
  /** It came back — with whatever it said. */
  SETTLED: 'settled',
  /** The countdown reached zero without a submission. */
  WINDOW_CLOSED: 'window_closed',
} as const;

export type FactorEventType = (typeof FACTOR_EVENT)[keyof typeof FACTOR_EVENT];

export type FactorEvent =
  | { readonly type: typeof FACTOR_EVENT.ANSWER_CHOSEN; readonly answer: FactorAnswerKind }
  | { readonly type: typeof FACTOR_EVENT.SUBMITTED }
  | { readonly type: typeof FACTOR_EVENT.SETTLED; readonly result: CompleteFactorFailure }
  | { readonly type: typeof FACTOR_EVENT.WINDOW_CLOSED };

export function factorReducer(state: FactorState, event: FactorEvent): FactorState {
  switch (event.type) {
    case FACTOR_EVENT.ANSWER_CHOSEN:
      // The refusal goes with the control it was about. See the header.
      return { answer: event.answer, standing: { kind: FACTOR_STANDING.OPEN } };

    case FACTOR_EVENT.SUBMITTED:
      // A refusal must not sit above an attempt that is still running. It stays gone on the way
      // back: `SETTLED` names the whole state too.
      return { ...state, standing: { kind: FACTOR_STANDING.OPEN } };

    case FACTOR_EVENT.WINDOW_CLOSED:
      // Idempotent, and that is not defensive tidiness: the clock keeps ticking after the form is
      // replaced, so a fresh object here would repaint the lapsed callout every fifteen seconds
      // for as long as the reader leaves it open.
      return state.standing.kind === FACTOR_STANDING.LAPSED
        ? state
        : { ...state, standing: { kind: FACTOR_STANDING.LAPSED } };

    default:
      // `undefined` is the redirect winning — this tree is already unmounting, and writing a
      // "nothing was refused" state over it would repaint the form for the frame before it goes.
      if (!event.result) return state;
      // The server found no challenge either: the same standing the countdown produces, because it
      // is the same fact and the reader needs the same sentence.
      return event.result.status === FACTOR_LAPSED
        ? { ...state, standing: { kind: FACTOR_STANDING.LAPSED } }
        : { ...state, standing: { kind: FACTOR_STANDING.REFUSED, failure: event.result } };
  }
}

/**
 * Whether the failure is the FR-4 lockout — the one refusal whose way out is not "type it again".
 *
 * Factor failures count toward the **same** `failed_attempts` as the password step (task 27.3: a
 * separate budget would hand out 10^6 free guesses), so this step reaches the lockout like S-01
 * does, and offers the same release — the reset link is the only one before Phase 8.
 */
export const isLockout = (standing: FactorStanding): boolean =>
  standing.kind === FACTOR_STANDING.REFUSED &&
  standing.failure.status === API_OUTCOME.Problem &&
  standing.failure.problem.type === PROBLEM_TYPE.AccountLocked;
