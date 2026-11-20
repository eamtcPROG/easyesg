import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';

/**
 * S-49's decision as one state (task 67.20) — whether the put-back is being confirmed, whether a decision is in flight,
 * and how the last one came out. **One reducer** because one event moves several of them: confirming the put-back closes
 * the dialogue and starts the request, and its answer ends the request and names the outcome.
 */
export const DECISION = {
  KEEP: 'keep',
  PUT_BACK: 'put-back',
} as const;

export type Decision = (typeof DECISION)[keyof typeof DECISION];

export const DECISION_OUTCOME = {
  KEPT: 'kept',
  PUT_BACK: 'put-back',
  /** A colleague decided first, or nothing was held: the report's own screen is the way on. */
  NOTHING_TO_DECIDE: 'nothing-to-decide',
  /** The period was locked since the move: reopening it (S-14) comes before a put-back. */
  LOCKED: 'locked',
  /** No answer arrived; deciding again is safe, since each decision is refused once made. */
  UNREACHABLE: 'unreachable',
} as const;

export type DecisionOutcome = (typeof DECISION_OUTCOME)[keyof typeof DECISION_OUTCOME];

/** HTTP's, compared as a number rather than spelled at each site. */
const NOT_FOUND_STATUS = 404;

/** What one decision's answer means for the screen. */
export function decisionOutcomeOf(input: { readonly decision: Decision; readonly outcome: ApiOutcome<unknown> }): DecisionOutcome {
  const { outcome } = input;
  if (outcome.status === API_OUTCOME.Ok) {
    return input.decision === DECISION.KEEP ? DECISION_OUTCOME.KEPT : DECISION_OUTCOME.PUT_BACK;
  }
  if (outcome.status === API_OUTCOME.Problem && outcome.problem.type === PROBLEM_TYPE.ReportNotEditable) {
    return DECISION_OUTCOME.LOCKED;
  }
  if (outcome.status === API_OUTCOME.Problem && outcome.problem.status === NOT_FOUND_STATUS) {
    return DECISION_OUTCOME.NOTHING_TO_DECIDE;
  }
  return DECISION_OUTCOME.UNREACHABLE;
}

export interface DecisionState {
  readonly confirmingPutBack: boolean;
  readonly pending: Decision | null;
  readonly outcome: DecisionOutcome | null;
}

export const INITIAL_DECISION: DecisionState = { confirmingPutBack: false, pending: null, outcome: null };

export const DECISION_EVENT = {
  PUT_BACK_ASKED: 'put-back-asked',
  PUT_BACK_DISMISSED: 'put-back-dismissed',
  SUBMITTED: 'submitted',
  ANSWERED: 'answered',
} as const;

export type DecisionEvent =
  | { readonly type: typeof DECISION_EVENT.PUT_BACK_ASKED }
  | { readonly type: typeof DECISION_EVENT.PUT_BACK_DISMISSED }
  | { readonly type: typeof DECISION_EVENT.SUBMITTED; readonly decision: Decision }
  | { readonly type: typeof DECISION_EVENT.ANSWERED; readonly outcome: DecisionOutcome };

export function decisionReducer(state: DecisionState, event: DecisionEvent): DecisionState {
  switch (event.type) {
    case DECISION_EVENT.PUT_BACK_ASKED:
      // A previous failure's notice no longer describes what the reader is about to do.
      return { confirmingPutBack: true, pending: null, outcome: null };
    case DECISION_EVENT.PUT_BACK_DISMISSED:
      return { ...state, confirmingPutBack: false };
    case DECISION_EVENT.SUBMITTED:
      return { confirmingPutBack: false, pending: event.decision, outcome: null };
    case DECISION_EVENT.ANSWERED:
      return { confirmingPutBack: false, pending: null, outcome: event.outcome };
  }
}
