import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { SystemAuditLogEntry } from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';
import { logApiPath, type LogView } from '../tools/accounts-search';

/**
 * A-08's log (task 67.4) — `GET /admin/audit-log`, keyed by what the api is asked. **`keepPreviousData`**
 * is §8.1's *loading — refresh*: the previous page stays readable while a new filter or page loads.
 * Every account action invalidates this key's prefix, so the entry an operator just caused appears
 * without a reload.
 */
export const SYSTEM_AUDIT_LOG_QUERY_KEY = ['admin', 'system-audit-log'] as const;

export const systemAuditLogQuery = (view: LogView) =>
  queryOptions({
    queryKey: [...SYSTEM_AUDIT_LOG_QUERY_KEY, view.operator, view.action, view.from, view.to, view.page] as const,
    queryFn: () => api.list<SystemAuditLogEntry>(logApiPath(view)),
    placeholderData: keepPreviousData,
  });
