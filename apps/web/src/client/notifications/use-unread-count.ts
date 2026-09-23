'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EVENT_NAME } from '@easyesg/contracts';
import { POLL_INTERVAL, nextPollDelay } from '@/client/polling/poll-schedule';
import { useFrame } from '@/client/push/use-frame';
import { readUnreadCount } from './read-unread-count';
import { NOTIFICATIONS_QUERY_SCOPE, unreadCountQueryKey } from './notifications-query-keys';
import { settleUnreadCount, type UnreadCountState } from './unread-count-state';

/**
 * The reader's unread count in the active organization, polled on OQ-36's schedule (task 50.2.1; FR-161, UX-62).
 *
 * **One query, however many read it**: two components mounting this hook share one fetch and one schedule, because
 * the key is one. **Stopped while the tab is hidden** (`refetchIntervalInBackground: false`), which is the control
 * that makes OQ-36's budget hold rather than the interval itself. `null` until the first read answers — the badge
 * draws nothing rather than a zero it does not know — and again after an organization switch, whose count is a key
 * of its own (`notifications-query-keys.ts` says why).
 *
 * **Accelerated since task 149** (AD-15): a `notification.unread_changed` frame for this organization invalidates the
 * notification scope — the count, and the panel's lists if open — exactly as a mark does, so the next read comes sooner
 * than the minute. The poll is untouched by it (NFR-110). **`cancelRefetch: false`** because both the bell and the
 * drawer's row mount this hook, and each hears the frame: the second invalidation joins the read the first started
 * rather than cancelling it for a second request.
 */
export function useUnreadCount(organizationId: string): number | null {
  const client = useQueryClient();
  const queryKey = unreadCountQueryKey(organizationId);
  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<UnreadCountState> =>
      settleUnreadCount({
        previous: client.getQueryData<UnreadCountState>(queryKey),
        read: await readUnreadCount(),
      }),
    refetchInterval: (query) =>
      nextPollDelay({ interval: POLL_INTERVAL.UNREAD_COUNT, failures: query.state.data?.failures ?? 0 }),
    refetchIntervalInBackground: false,
  });
  useFrame({
    event: EVENT_NAME.NOTIFICATION_UNREAD_CHANGED,
    organizationId,
    onFrame: () => void client.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_SCOPE }, { cancelRefetch: false }),
  });
  return data?.unread ?? null;
}
