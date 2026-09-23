/**
 * A server-rendered surface's poll, as state (task 149) — whether a refresh is in flight, how many in a row answered
 * with the read failed, and which round of the schedule this is.
 *
 * **`round` is what reschedules**: every settled refresh and every tick skipped while the tab was hidden starts a new
 * round, so the schedule's timer is set again even when nothing else changed — a run of successes leaves `failures` at
 * zero, and a timer keyed on it alone would fire once and never again.
 *
 * **A settle counts only a refresh this poll started**, or a frame's refresh; a re-render of the route for another
 * reason — a Server Action revalidating it — arrives while nothing is in flight and moves nothing.
 */
export interface RefreshPollState {
  readonly inFlight: boolean;
  readonly failures: number;
  readonly round: number;
}

export const REFRESH_POLL_EVENT = {
  /** A refresh was asked for — by the schedule, or by a frame. */
  REFRESH_STARTED: 'refresh_started',
  /** The route rendered again; `failed` is that render's own verdict on its read. */
  RENDER_SETTLED: 'render_settled',
  /** The schedule fell due while the tab was hidden, and ran nothing (OQ-36). */
  SKIPPED_HIDDEN: 'skipped_hidden',
} as const;

export type RefreshPollEvent =
  | { readonly type: typeof REFRESH_POLL_EVENT.REFRESH_STARTED }
  | { readonly type: typeof REFRESH_POLL_EVENT.RENDER_SETTLED; readonly failed: boolean }
  | { readonly type: typeof REFRESH_POLL_EVENT.SKIPPED_HIDDEN };

export const INITIAL_REFRESH_POLL: RefreshPollState = { inFlight: false, failures: 0, round: 0 };

export const refreshPollReducer = (state: RefreshPollState, event: RefreshPollEvent): RefreshPollState => {
  switch (event.type) {
    case REFRESH_POLL_EVENT.REFRESH_STARTED:
      return state.inFlight ? state : { ...state, inFlight: true };
    case REFRESH_POLL_EVENT.RENDER_SETTLED:
      if (!state.inFlight) return state;
      return { inFlight: false, failures: event.failed ? state.failures + 1 : 0, round: state.round + 1 };
    case REFRESH_POLL_EVENT.SKIPPED_HIDDEN:
      return { ...state, round: state.round + 1 };
  }
};
