'use client';

import type { DisclosureValueResponse, DisclosureValueWrite } from '@easyesg/contracts';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { API_OUTCOME } from '@/lib/api-outcome';
import {
  ACKNOWLEDGEMENT_BUDGET_MS,
  AUTOSAVE_EVENT,
  CONNECTION,
  FLUSH_FAILURE,
  autosaveReducer,
  canFlush,
  flushSnapshot,
  hasUnsynced,
  initialAutosaveState,
  type AutosaveState,
  type FlushFailure,
} from '@/features/wizard/autosave-state';
import type { PendingWriteStore } from './pending-store';
import { putDisclosureValues } from './write-values';

/**
 * The wizard's persistence model, live (task 35.2; AD-9's §4.10, §11.1).
 *
 * FR-37 autosave on blur or step change, with no save button. FR-38 queue locally and retry while
 * offline. NFR-38 p95 ≤ 250 ms, never blocking input. NFR-56 no acknowledged change is ever lost —
 * acknowledge only after a durable write.
 *
 * **The state is `autosave-state.ts`'s reducer; this is the wiring** — the reducer plus a transport,
 * a clock, the network events, the durable queue and the unload guard, published as one value and
 * two actions. Nothing here decides what *saved* means; the reducer does, and it is tested there.
 *
 * ## The transport is TanStack Query's mutation, and only the transport
 *
 * §12.1 pinned Query for *"debounced batched mutations with retry"*, and that is the part of the
 * problem it solves: one `useMutation` whose function reads the reducer's snapshot at the moment it
 * runs, retries an unreachable API with exponential backoff, and — `networkMode: 'online'` — holds
 * a retry until the browser reports a connection. What it does **not** own is the queue: its
 * mutation cache is memory, and FR-38's queue has to outlive the tab (§4.10), so the pending set
 * lives in the reducer and is mirrored to `PendingWriteStore` on every change. `access-context.tsx`
 * recorded why Query does not fit a screen's own state; here it fits exactly one seam.
 *
 * ## Batching is coalescing, not a timer
 *
 * A change flushes at once when nothing is on the wire; changes made while a flush is out
 * accumulate and leave together in the next one. That is "debounced batched" without a debounce
 * timer, and the timer was declined on purpose: every millisecond of delay before the request is a
 * millisecond spent from NFR-38's budget before the API has seen anything.
 *
 * ## The acknowledgement is the response, never the request
 *
 * `FLUSH_SUCCEEDED` is dispatched from `onSuccess` with what the API returned — the rows as
 * committed. Nothing moves a write out of `pending` before that. An optimistic acknowledgement
 * would pass every ordinary test and lose data exactly once, in production (NFR-56).
 *
 * ## A step change persists; it does not fire
 *
 * Unmount writes nothing to the API. The queue is already in the store, and the next step's mount
 * restores and flushes it — so the indicator on the new step tells the truth about writes the old
 * step left, which is the deliverable's own sentence. A request fired during navigation would race
 * the store's write and the new page's read; the store's transaction ordering is what makes the
 * hand-off safe, and it only holds if nothing else is also in flight.
 */

/** The transport's own retry policy: unreachable only, three attempts, 1 s → 2 s → 4 s. */
export const TRANSPORT_RETRIES = 3;
export const retryDelay = (attempt: number): number => Math.min(1000 * 2 ** attempt, 30_000);

/** The retry schedule, as a seam: the spec drives the count with no delay under real timers. */
export interface RetrySchedule {
  readonly retries: number;
  readonly delayMs: (attempt: number) => number;
}

const DEFAULT_RETRY_SCHEDULE: RetrySchedule = { retries: TRANSPORT_RETRIES, delayMs: retryDelay };

/** After the transport gives up, how long the hook waits before asking again on its own. */
const UNREACHABLE_RETRY_MS = 30_000;

/** Thrown by the mutation so Query retries; carries the failure the reducer records. */
class FlushError extends Error {
  constructor(readonly failure: FlushFailure) {
    super(`autosave flush failed: ${failure.kind}`);
  }
}

export interface AutosaveHandle {
  readonly state: AutosaveState;
  /** A field's new value, or its clearing — the reducer's `CHANGED`. */
  readonly change: (write: DisclosureValueWrite) => void;
  /** Another attempt after a failure — the banner's retry, and the backoff timer's. */
  readonly retry: () => void;
  /** Whether the queue survives this tab — what the memory fallback gives up. */
  readonly durable: boolean;
}

export function useAutosave(input: {
  readonly reportId: string;
  /** `pendingWriteScope(...)` — account and report, never the report alone. */
  readonly scope: string;
  readonly store: PendingWriteStore & { readonly durable: boolean };
  /** Test seam; the browser's `fetch` otherwise. */
  readonly fetch?: typeof fetch;
  /** Test seam; the exponential schedule above otherwise. */
  readonly retrySchedule?: RetrySchedule;
}): AutosaveHandle {
  const { reportId, scope, store } = input;
  const schedule = input.retrySchedule ?? DEFAULT_RETRY_SCHEDULE;
  const [state, dispatch] = useReducer(
    autosaveReducer,
    { online: typeof navigator === 'undefined' ? true : navigator.onLine },
    initialAutosaveState,
  );

  // The mutation function reads the LATEST state when it runs, not the state at the render that
  // created it — a paused or retried flush must carry what accumulated while it waited.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const flush = useMutation<DisclosureValueResponse[], FlushError>({
    mutationFn: async () => {
      const { writes, sent } = flushSnapshot(latest.current);
      dispatch({ type: AUTOSAVE_EVENT.FLUSH_STARTED, sent });
      const outcome = await putDisclosureValues({ reportId, values: writes, fetch: input.fetch });
      if (outcome.status === API_OUTCOME.Ok) return outcome.value;
      throw new FlushError(
        outcome.status === API_OUTCOME.Problem
          ? { kind: FLUSH_FAILURE.REFUSED, problem: outcome.problem }
          : { kind: FLUSH_FAILURE.UNREACHABLE },
      );
    },
    networkMode: 'online',
    retry: (count, error) =>
      error.failure.kind === FLUSH_FAILURE.UNREACHABLE && count < schedule.retries,
    retryDelay: schedule.delayMs,
    onSuccess: (committed) => dispatch({ type: AUTOSAVE_EVENT.FLUSH_SUCCEEDED, committed }),
    onError: (error) => dispatch({ type: AUTOSAVE_EVENT.FLUSH_FAILED, failure: error.failure }),
  });
  const { mutate, isPending } = flush;

  // Restore the durable queue once, then mirror every change back to it. The guard on `hydrated`
  // is what stops the first render's empty set from wiping a queue that has not been read yet.
  useEffect(() => {
    let cancelled = false;
    void store.load(scope).then((writes) => {
      if (!cancelled) dispatch({ type: AUTOSAVE_EVENT.RESTORED, writes });
    });
    return () => {
      cancelled = true;
    };
  }, [store, scope]);

  useEffect(() => {
    if (!state.hydrated) return;
    void store.save(
      scope,
      Object.values(state.pending)
        .sort((a, b) => a.sequence - b.sequence)
        .map((item) => item.write),
    );
  }, [store, scope, state.hydrated, state.pending]);

  // The one place a flush leaves from. `isPending` covers a flush Query is holding for the network
  // or a retry delay, which the reducer sees as "not in flight" between attempts.
  useEffect(() => {
    if (state.hydrated && canFlush(state) && !isPending) mutate();
  }, [state, isPending, mutate]);

  useEffect(() => {
    const online = () =>
      dispatch({ type: AUTOSAVE_EVENT.CONNECTION_CHANGED, connection: CONNECTION.ONLINE });
    const offline = () =>
      dispatch({ type: AUTOSAVE_EVENT.CONNECTION_CHANGED, connection: CONNECTION.OFFLINE });
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // NFR-38's clock: started when something becomes pending, cleared when nothing is. The reducer
  // ignores the event if everything was acknowledged in the meantime.
  const pending = hasUnsynced(state);
  useEffect(() => {
    if (!pending || state.budgetExceeded) return;
    const timer = window.setTimeout(
      () => dispatch({ type: AUTOSAVE_EVENT.BUDGET_ELAPSED }),
      ACKNOWLEDGEMENT_BUDGET_MS,
    );
    return () => window.clearTimeout(timer);
  }, [pending, state.budgetExceeded, state.inFlight]);

  // After the transport's own retries, keep trying on a slow clock while the API is unreachable.
  // A refusal is not retried on a timer: the same request would be refused again.
  const unreachable = state.failure?.kind === FLUSH_FAILURE.UNREACHABLE;
  useEffect(() => {
    if (!unreachable || !pending) return;
    const timer = window.setTimeout(
      () => dispatch({ type: AUTOSAVE_EVENT.RETRY_REQUESTED }),
      UNREACHABLE_RETRY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [unreachable, pending]);

  // UX-37: leaving the origin with something unsent is warned about, with a chance to cancel.
  // The browser owns the dialogue; the page can only ask for it.
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const change = useCallback(
    (write: DisclosureValueWrite) => dispatch({ type: AUTOSAVE_EVENT.CHANGED, write }),
    [],
  );
  const retry = useCallback(() => dispatch({ type: AUTOSAVE_EVENT.RETRY_REQUESTED }), []);

  return { state, change, retry, durable: store.durable };
}
