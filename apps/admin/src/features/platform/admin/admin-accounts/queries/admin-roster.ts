import { queryOptions } from '@tanstack/react-query';
import type { AdminRosterRow } from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';

/**
 * A-08's account table (task 67.4) — `GET /admin/accounts`, through the realm's one client. The
 * outcome is the answer, not a thrown error, A-02's reason: a 403 and a 401 are states the section
 * draws, and a retry would ask again for an answer already final. **No poll** (UX-116): an action on
 * this screen invalidates the key, and the client refetches on focus.
 */
export const ADMIN_ROSTER_QUERY_KEY = ['admin', 'roster'] as const;

export const adminRosterQuery = () =>
  queryOptions({
    queryKey: ADMIN_ROSTER_QUERY_KEY,
    queryFn: () => api.list<AdminRosterRow>('/admin/accounts'),
  });
