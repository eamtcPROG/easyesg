import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type {
  ApiOutcome,
  DisclosureModuleSummary,
  DisclosureStep,
  OrganizationRegisterRow,
  RaiseSupportAccessRequest,
  Report,
  SupportAccessLogEntry,
  SupportAccessRaised,
} from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';
import { logIsMoving } from '../tools/support-access-read';
import { grantApiPath, logApiPath, type GrantScope } from '../tools/support-access-search';

/**
 * A-07's log, its request form's organization, and its two writes (task 67.9), through the realm's one client.
 * The outcome is the answer, not a thrown error — A-02's reason: a 403 and a 401 are states a region draws, and a
 * retry would ask again for an answer already final.
 *
 * **The log polls only while it is moving** (`logIsMoving`): every read of it is itself logged, so a console left
 * open on a finished log writes nothing, and one watching a request waits at most half a minute to see it answered.
 * The countdown does not need the poll — it counts down from the expiry the last read carried.
 */
export const SUPPORT_ACCESS_QUERY_KEY = ['admin', 'support-access'] as const;

const MOVING_LOG_POLL_MS = 30 * 1000;

export const supportAccessLogQuery = (page: number) =>
  queryOptions({
    queryKey: [...SUPPORT_ACCESS_QUERY_KEY, 'log', page] as const,
    queryFn: () => api.list<SupportAccessLogEntry>(logApiPath(page)),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (logIsMoving(query.state.data) ? MOVING_LOG_POLL_MS : false),
  });

/** The organization a request is written for, by id — the register's row, read and logged as A-02's is. */
export const requestOrganizationQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ['admin', 'organization', organizationId] as const,
    queryFn: () => api.get<OrganizationRegisterRow>(`/admin/organizations/${encodeURIComponent(organizationId)}`),
  });

/**
 * The reads a running grant opens (task 67.9). **Each one writes an access row before it answers**, so none of
 * them is ever re-asked behind the operator's back: no refetch on focus, no staleness to refresh, and nothing kept
 * once the view that asked is gone — reopening a module is a new read, and the log says so. **Their own key root**,
 * so invalidating the log after an end or a request can never refetch one of them.
 */
const GRANT_READ_KEY = ['admin', 'support-access-grant'] as const;

const ONLY_WHEN_OPENED = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 0,
  refetchOnWindowFocus: false,
} as const;

export const grantReportsQuery = (grant: GrantScope) =>
  queryOptions({
    queryKey: [...GRANT_READ_KEY, grant.requestId, 'reports'] as const,
    queryFn: () => api.list<Report>(grantApiPath(grant)),
    ...ONLY_WHEN_OPENED,
  });

export const grantModulesQuery = (grant: GrantScope & { readonly reportId: string }) =>
  queryOptions({
    queryKey: [...GRANT_READ_KEY, grant.requestId, 'modules', grant.reportId] as const,
    queryFn: () => api.list<DisclosureModuleSummary>(grantApiPath(grant)),
    ...ONLY_WHEN_OPENED,
  });

export const grantStepQuery = (grant: GrantScope & { readonly reportId: string; readonly module: string }) =>
  queryOptions({
    queryKey: [...GRANT_READ_KEY, grant.requestId, 'step', grant.reportId, grant.module] as const,
    queryFn: () => api.get<DisclosureStep>(grantApiPath(grant)),
    ...ONLY_WHEN_OPENED,
  });

/** Asks the organization; grants nothing. Recorded in the system audit log by the api. */
export function raiseSupportAccess(
  command: RaiseSupportAccessRequest,
): Promise<ApiOutcome<SupportAccessRaised>> {
  return api.post<RaiseSupportAccessRequest, SupportAccessRaised>('/admin/support-access', command);
}

/** Ends a running grant — any Platform Administrator's, on any grant. */
export function endSupportAccess(grant: GrantScope): Promise<ApiOutcome<undefined>> {
  return api.post(
    `/admin/organizations/${encodeURIComponent(grant.organizationId)}/support-access/${encodeURIComponent(grant.requestId)}/end`,
    {},
  );
}
