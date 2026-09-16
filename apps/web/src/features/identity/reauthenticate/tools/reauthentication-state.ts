import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { FACTOR_ANSWER, FACTOR_LAPSED, type FactorAnswerKind } from '../../shared/tools/factor';
import { REAUTHENTICATION, type ReauthenticationAnswer } from './reauthentication-answer';

/**
 * The re-authentication dialogue as one value and the events that move it (task 92; UC-07, UC-194,
 * UC-195).
 *
 * **Three fields move together on four events**, which is the reducer rule's case: an answer from the
 * api writes the stage, the affordance and the refusal at once — a code required moves to the second
 * stage *and* clears the password's refusal *and* starts at the authenticator's code — and as three
 * setters each call site would have to remember the other two.
 *
 * **A lapse is a refusal at the first stage, not a stage of its own.** S-01 replaces its form with the
 * way back to its password screen; here the password stage *is* the way back, so the dialogue returns to
 * it and says why. That difference is why S-01's `factor-state.ts` is not reused: the vocabulary of the
 * answer is shared (`shared/tools/factor.ts`) and what a lapse does is each journey's own.
 *
 * **Resuming changes nothing here.** The dialogue closes because the screen beneath it says the session
 * is held again, and this state goes with it; writing a state for an answer nobody will see is the frame
 * of repaint `factor-state.ts` records declining too.
 */

export const REAUTHENTICATION_STAGE = {
  /** The account's password — the artboard's one field. */
  PASSWORD: 'password',
  /** The authenticator's code or a recovery code, for an account with a second factor. */
  FACTOR: 'factor',
} as const;

export type ReauthenticationStage = (typeof REAUTHENTICATION_STAGE)[keyof typeof REAUTHENTICATION_STAGE];

export const REAUTHENTICATION_REFUSAL = {
  /** The api said no, or could not be reached. */
  FAILED: 'failed',
  /** The code came too late: the password is asked for again. */
  LAPSED: 'lapsed',
  /** Someone else holds this browser's session: nothing is replaced, and signing out is the way on. */
  ACCOUNT_CHANGED: 'account-changed',
} as const;

export type ReauthenticationRefusal =
  | { readonly kind: typeof REAUTHENTICATION_REFUSAL.FAILED; readonly failure: ApiFailure }
  | { readonly kind: typeof REAUTHENTICATION_REFUSAL.LAPSED }
  | { readonly kind: typeof REAUTHENTICATION_REFUSAL.ACCOUNT_CHANGED };

export interface ReauthenticationState {
  readonly stage: ReauthenticationStage;
  /** Which control the second stage shows. Presentation — the api takes one field for both. */
  readonly answer: FactorAnswerKind;
  readonly refusal: ReauthenticationRefusal | null;
}

export const INITIAL_REAUTHENTICATION_STATE: ReauthenticationState = {
  stage: REAUTHENTICATION_STAGE.PASSWORD,
  answer: FACTOR_ANSWER.AUTHENTICATOR,
  refusal: null,
};

/** Named for what happened, never for the field written. */
export const REAUTHENTICATION_EVENT = {
  /** A password or a code left for the web tier. */
  SUBMITTED: 'submitted',
  /** It came back, with whatever the handler answered. */
  SETTLED: 'settled',
  /** The reader chose the other way of answering the second stage. */
  ANSWER_CHOSEN: 'answer_chosen',
  /** The reader went back from the code to the password. */
  RESTARTED: 'restarted',
} as const;

export type ReauthenticationEvent =
  | { readonly type: typeof REAUTHENTICATION_EVENT.SUBMITTED }
  | { readonly type: typeof REAUTHENTICATION_EVENT.SETTLED; readonly answer: ReauthenticationAnswer }
  | { readonly type: typeof REAUTHENTICATION_EVENT.ANSWER_CHOSEN; readonly answer: FactorAnswerKind }
  | { readonly type: typeof REAUTHENTICATION_EVENT.RESTARTED };

export function reauthenticationReducer(
  state: ReauthenticationState,
  event: ReauthenticationEvent,
): ReauthenticationState {
  switch (event.type) {
    case REAUTHENTICATION_EVENT.SUBMITTED:
      // A refusal must not sit above an attempt that is still running.
      return state.refusal === null ? state : { ...state, refusal: null };

    case REAUTHENTICATION_EVENT.ANSWER_CHOSEN:
      // The refusal goes with the control it was about.
      return { ...state, answer: event.answer, refusal: null };

    case REAUTHENTICATION_EVENT.RESTARTED:
      return INITIAL_REAUTHENTICATION_STATE;

    default:
      return settled(state, event.answer);
  }
}

function settled(state: ReauthenticationState, answer: ReauthenticationAnswer): ReauthenticationState {
  switch (answer.status) {
    case REAUTHENTICATION.RESUMED:
      return state;
    case REAUTHENTICATION.FACTOR_REQUIRED:
      return { stage: REAUTHENTICATION_STAGE.FACTOR, answer: FACTOR_ANSWER.AUTHENTICATOR, refusal: null };
    case FACTOR_LAPSED:
      return { ...INITIAL_REAUTHENTICATION_STATE, refusal: { kind: REAUTHENTICATION_REFUSAL.LAPSED } };
    case REAUTHENTICATION.ACCOUNT_CHANGED:
      return { ...state, refusal: { kind: REAUTHENTICATION_REFUSAL.ACCOUNT_CHANGED } };
    default:
      return { ...state, refusal: { kind: REAUTHENTICATION_REFUSAL.FAILED, failure: answer } };
  }
}

/**
 * Whether the refusal is FR-4's lockout — the one whose way out is not *type it again* but the reset
 * link, which is a different screen and so the one remedy the dialogue offers as a link.
 */
export const refusalIsLockout = (refusal: ReauthenticationRefusal | null): boolean =>
  refusal?.kind === REAUTHENTICATION_REFUSAL.FAILED &&
  refusal.failure.status === API_OUTCOME.Problem &&
  refusal.failure.problem.type === PROBLEM_TYPE.AccountLocked;
