'use client';

import { useCallback, useEffect, useReducer, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { runValidationAction } from '../../../actions/actions';
import { CHECK_EVENT, CHECK_STAGE, INITIAL_CHECK_STATE, checkReducer, type CheckStage } from '../../../tools/check-state';
import { flushIsBlocked } from '../../../tools/autosave-state';
import { useAutosaveContext } from '../../providers/autosave-context';

export interface CheckReport {
  readonly stage: CheckStage;
  /** The last run's refusal, until the next press. */
  readonly failure: ApiFailure | null;
  /** A run in flight, or its result being drawn — the panel is busy until both are done (§8.5). */
  readonly busy: boolean;
  readonly press: () => void;
}

/**
 * ***Check my report*** (task 42.2; UC-40, UX-24; `architecture.md` §12.5.6's task-42 row (d)) — the run, preceded by
 * what the wizard holds unsent.
 *
 * **What is unsent goes first**, as an organization switch sends it (UX-37): a press with answers queued asks the queue
 * to try now and waits; once nothing is unsent the run goes, and where the answers cannot go the state says it is stuck
 * — and runs after all if they go later. **A run is refreshed into the step, not merged into it**: on success the
 * step re-reads, so the list, the heading and the panel draw the new run together, and the panel stays busy across
 * both halves — the action and the refresh — as one transition.
 *
 * **Why an effect rather than the handler**: the queue drains on its own schedule, after the press, so what moves a
 * waiting check on is a change in the queue — the switch's own arrangement (`organization-switch-provider.tsx`).
 */
export function useCheckReport(reportId: string): CheckReport {
  const { state: autosave, unsynced, retry } = useAutosaveContext();
  const blocked = flushIsBlocked(autosave);
  const router = useRouter();
  const [check, dispatch] = useReducer(checkReducer, INITIAL_CHECK_STATE);
  const [refreshing, startTransition] = useTransition();

  const run = useCallback(() => {
    startTransition(async () => {
      const outcome = await runValidationAction({ reportId });
      // Marked as a transition again, because it follows an `await` — what keeps the panel busy until the step re-reads.
      if (outcome.status === API_OUTCOME.Ok) startTransition(() => router.refresh());
      dispatch({ type: CHECK_EVENT.RUN_SETTLED, outcome });
    });
  }, [reportId, router]);

  const press = useCallback(() => {
    const unsent = unsynced > 0;
    dispatch({ type: CHECK_EVENT.PRESSED, unsent });
    // UX-37's *sent first*: another attempt now, rather than on the queue's own backoff.
    if (unsent) retry();
    else run();
  }, [unsynced, retry, run]);

  // A waiting check moves when its answers do: run once they have gone, stuck while they cannot go.
  useEffect(() => {
    if (check.stage !== CHECK_STAGE.WAITING && check.stage !== CHECK_STAGE.STUCK) return;
    if (unsynced === 0) {
      dispatch({ type: CHECK_EVENT.QUEUE_DRAINED });
      run();
    } else if (blocked) dispatch({ type: CHECK_EVENT.QUEUE_STUCK });
  }, [check.stage, unsynced, blocked, run]);

  return {
    stage: check.stage,
    failure: check.failure,
    busy: check.stage === CHECK_STAGE.RUNNING || refreshing,
    press,
  };
}
