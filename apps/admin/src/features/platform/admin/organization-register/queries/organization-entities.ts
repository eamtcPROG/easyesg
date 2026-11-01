import { queryOptions } from '@tanstack/react-query';
import type { OrganizationEntity } from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';

/**
 * A-02's record's entities (task 175), through the realm's one client — the answer the outcome, not a thrown error,
 * for the register's reason. **Keyed by the organization and never polled**, as the record's people are: the list
 * changes when an entity is added or archived, and every read of it is logged.
 */
export const organizationEntitiesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ['admin', 'organization-entities', organizationId] as const,
    queryFn: () => api.list<OrganizationEntity>(`/admin/organizations/${organizationId}/entities`),
  });
