'use client';

import { useCallback, useEffect, useReducer, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { nextPollDelay } from './poll-schedule';
import { tabIsVisible } from './tab-visibility';
import { INITIAL_REFRESH_POLL, REFRESH_POLL_EVENT, refreshPollReducer } from './refresh-poll-state';

/**
 * The poll of a surface the server renders (task 149; OQ-36, §12.5.6's task-149 row (1)) — S-16's first. **The read
 * it repeats is the route's own server render**, `router.refresh()` through the session, which is the read the screen
 * already makes: nothing here fetches, so there is no second data path around the pass-through (AD-9).
 *
 * **Its schedule is the query polls'**: the interval after a refresh that settled, OQ-36's full-jitter backoff while
 * the render says its read failed — `failed` is that verdict, passed by the surface from what it just read — and
 * nothing while the tab is hidden, a due tick simply rescheduled. **Settled is when the transition carrying the
 * refresh commits**, which is also when the new `failed` arrives, so the two are read together.
 *
 * **It answers the refresh**, for the surface's frame to call (`useFrame`): a frame's refresh settles like the poll's
 * and starts the next interval from there, so the gap between two reads never exceeds the interval (NFR-110).
 */
export function useRefreshPoll(input: { readonly interval: number; readonly failed: boolean }): () => void {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [state, dispatch] = useReducer(refreshPollReducer, INITIAL_REFRESH_POLL);
  const { interval, failed } = input;

  const refresh = useCallback(() => {
    dispatch({ type: REFRESH_POLL_EVENT.REFRESH_STARTED });
    startRefresh(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (!refreshing) dispatch({ type: REFRESH_POLL_EVENT.RENDER_SETTLED, failed });
  }, [refreshing, failed]);

  useEffect(() => {
    if (state.inFlight) return;
    const timer = setTimeout(
      () => {
        if (tabIsVisible()) refresh();
        else dispatch({ type: REFRESH_POLL_EVENT.SKIPPED_HIDDEN });
      },
      nextPollDelay({ interval, failures: state.failures }),
    );
    return () => clearTimeout(timer);
  }, [state.inFlight, state.round, state.failures, interval, refresh]);

  return refresh;
}
