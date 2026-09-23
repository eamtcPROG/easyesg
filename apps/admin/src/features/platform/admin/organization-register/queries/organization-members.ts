import { queryOptions } from '@tanstack/react-query';
import type { DisclosedPhone, OrganizationMember } from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';

/**
 * A-02's record's people, and one member's phone (task 167; §12.5.6's task-167 row), through the realm's one client —
 * the answer the outcome, not a thrown error, for the register's reason.
 *
 * **Keyed by the organization**, so reopening a record reads its people again only when the cache has gone stale.
 * **No poll**: the list changes when someone joins or leaves, and every read of it is logged.
 */
const membersPath = (organizationId: string) => `/admin/organizations/${organizationId}/members`;

export const organizationMembersQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ['admin', 'organization-members', organizationId] as const,
    queryFn: () => api.list<OrganizationMember>(membersPath(organizationId)),
  });

/**
 * One member's phone — a POST, because each is written to the system audit log (task 167). **Never cached**: the
 * number lives in the row that asked for it, and closing the record forgets it.
 */
export const discloseMemberPhone = (input: { readonly organizationId: string; readonly accountId: string }) =>
  api.post<undefined, DisclosedPhone>(`${membersPath(input.organizationId)}/${input.accountId}/phone-disclosure`, undefined);
