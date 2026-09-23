'use client';

import { EVENT_NAME } from '@easyesg/contracts';
import { POLL_INTERVAL } from '@/client/polling/poll-schedule';
import { useRefreshPoll } from '@/client/polling/use-refresh-poll';
import { useFrame } from '@/client/push/use-frame';

/**
 * S-16's poll and its accelerator (task 149; OQ-36, AD-15) — the screen read again every 30 s, and sooner when an
 * `access.changed` frame for this organization arrives: an invitation accepted by someone else, a role changed or a
 * member removed in another tab.
 *
 * **It draws nothing and keeps nothing**: what it asks for is the route's own server render, so the list, the seat
 * counter and the reminder panel all arrive as the section already reads them (UX-138). **Outside the section's arms**,
 * so it runs on a read that failed — backing off by `readFailed` — and on a refused one, whose next render is what a
 * member promoted meanwhile would see.
 */
export function AccessPoll({
  organizationId,
  readFailed,
}: {
  readonly organizationId: string;
  readonly readFailed: boolean;
}) {
  const refresh = useRefreshPoll({ interval: POLL_INTERVAL.ACCESS_LIST, failed: readFailed });
  useFrame({ event: EVENT_NAME.ACCESS_CHANGED, organizationId, onFrame: refresh });
  return null;
}
