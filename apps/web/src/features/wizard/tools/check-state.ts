import { API_OUTCOME, type ApiFailure, type ApiOutcome } from '@/lib/api-outcome';

/**
 * ***Check my report*'s state** (task 42.2; UX-24; `architecture.md` §12.5.6's task-42 row (d)) — as one value and the
 * events that move it, because a press moves the stage and clears the last failure at once, and a run settling moves
 * both again.
 *
 * **A run sends what the wizard holds unsent first** (row (d)), as an organization switch does (UX-37): a press with
 * answers unsent *waits*, and moves to *running* once they are acknowledged, or to *stuck* where they cannot go — so a
 * run never checks answers older than the screen. A press with nothing unsent runs at once.
 *
 * Pure, and beside the feature rather than inside the control, so every transition is a unit spec — including *stuck*,
 * which a browser journey reaches only by contriving a dropped connection.
 */
export const CHECK_STAGE = {
  IDLE: 'idle',
  /** Pressed with answers unsent; waiting for the queue to drain. */
  WAITING: 'waiting',
  /** Pressed with answers unsent that cannot go now — offline, or refused. */
  STUCK: 'stuck',
  RUNNING: 'running',
} as const;

export type CheckStage = (typeof CHECK_STAGE)[keyof typeof CHECK_STAGE];

export interface CheckState {
  readonly stage: CheckStage;
  /** The last run's refusal, shown until the next press — `null` where it settled, or none has run. */
  readonly failure: ApiFailure | null;
}

export const INITIAL_CHECK_STATE: CheckState = { stage: CHECK_STAGE.IDLE, failure: null };

/** Named for what happened, never for the field it writes (the root `CLAUDE.md`'s reducer rule). */
export const CHECK_EVENT = {
  PRESSED: 'pressed',
  QUEUE_DRAINED: 'queue_drained',
  QUEUE_STUCK: 'queue_stuck',
  RUN_SETTLED: 'run_settled',
} as const;

export type CheckEvent =
  | { readonly type: typeof CHECK_EVENT.PRESSED; readonly unsent: boolean }
  | { readonly type: typeof CHECK_EVENT.QUEUE_DRAINED }
  | { readonly type: typeof CHECK_EVENT.QUEUE_STUCK }
  | { readonly type: typeof CHECK_EVENT.RUN_SETTLED; readonly outcome: ApiOutcome<null> };

export function checkReducer(state: CheckState, event: CheckEvent): CheckState {
  switch (event.type) {
    case CHECK_EVENT.PRESSED:
      // A press clears the last refusal: what follows is a new attempt, and the old sentence would describe it falsely.
      return { stage: event.unsent ? CHECK_STAGE.WAITING : CHECK_STAGE.RUNNING, failure: null };
    case CHECK_EVENT.QUEUE_DRAINED:
      return state.stage === CHECK_STAGE.IDLE || state.stage === CHECK_STAGE.RUNNING
        ? state
        : { ...state, stage: CHECK_STAGE.RUNNING };
    case CHECK_EVENT.QUEUE_STUCK:
      return state.stage === CHECK_STAGE.WAITING ? { ...state, stage: CHECK_STAGE.STUCK } : state;
    case CHECK_EVENT.RUN_SETTLED:
      return {
        stage: CHECK_STAGE.IDLE,
        failure: event.outcome.status === API_OUTCOME.Ok ? null : event.outcome,
      };
  }
}
