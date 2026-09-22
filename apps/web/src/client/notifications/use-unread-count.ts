'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { POLL_INTERVAL, nextPollDelay } from '@/client/polling/poll-schedule';
import { readUnreadCount } from './read-unread-count';
import { UNREAD_COUNT_QUERY_KEY } from './unread-count-key';
import { settleUnreadCount, type UnreadCountState } from './unread-count-state';

/**
 * The reader's unread count in the active organization, polled on OQ-36's schedule (task 50.2.1; FR-161, UX-62).
 *
 * **One query, however many read it**: two components mounting this hook share one fetch and one schedule, because
 * the key is one. **Stopped while the tab is hidden** (`refetchIntervalInBackground: false`), which is the control
 * that makes OQ-36's budget hold rather than the interval itself. `null` until the first read answers — the badge
 * draws nothing rather than a zero it does not know.
 */
export function useUnreadCount(): number | null {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: async (): Promise<UnreadCountState> =>
      settleUnreadCount({
        previous: client.getQueryData<UnreadCountState>(UNREAD_COUNT_QUERY_KEY),
        read: await readUnreadCount(),
      }),
    refetchInterval: (query) =>
      nextPollDelay({ interval: POLL_INTERVAL.UNREAD_COUNT, failures: query.state.data?.failures ?? 0 }),
    refetchIntervalInBackground: false,
  });
  return data?.unread ?? null;
}
