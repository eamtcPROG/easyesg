'use client';

import { useQuery } from '@tanstack/react-query';
import { panelQueryKey } from '@/client/notifications/notifications-query-keys';
import { readNotices } from '@/client/notifications/read-notices';
import type { NoticeShow } from '../../../../shared/tools/notice-list-query';
import { panelListQuery } from '../../../tools/panel-query';

/**
 * The panel's list for one view (task 50.2.2) — read through the pass-through when the panel is open, never before.
 *
 * **Fresh on every opening**: the query is stale at once, and a mounted query refetches when it becomes stale-and-
 * observed, so a panel opened a minute later shows what arrived meanwhile. **Each view is its own key**, and each
 * organization's, so switching
 * back to a view read a moment ago draws it at once while it refreshes. A mark anywhere invalidates the scope both
 * keys sit under (`notifications-query-keys.ts`), which is what redraws the list after *mark all*.
 *
 * `null` data is an answer that could not be read; `undefined` is one not yet arrived.
 */
export function usePanelNotices(input: { readonly organizationId: string; readonly show: NoticeShow }) {
  return useQuery({
    queryKey: panelQueryKey(input),
    queryFn: () => readNotices({ query: panelListQuery(input.show) }),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
