import type { OrganizationEntity } from '../models/organization-entity.model';

/** Which organization's entities, and who is reading — the acquisition log's requester (FR-79). */
export interface OrganizationEntitiesRead {
  readonly organizationId: string;
  /** `adminAccountId` from `AdminRealmGuard` — never a tenant actor. */
  readonly requesterId: string;
}

/**
 * A-02's record's entities (task 175). **Its adapter reads through `esg_admin_ro` and logs the acquisition before it
 * does**, as the members' store does. A port of its own for the members' reason: its reader is the record, not the
 * register, and neither of the record's lists is the other's business.
 */
export interface OrganizationEntitiesStore {
  /** Every reporting entity of the organization, active first, by name — or `null` for an id no organization holds. */
  entities(read: OrganizationEntitiesRead): Promise<readonly OrganizationEntity[] | null>;
}

export const ORGANIZATION_ENTITIES_STORE = Symbol('ORGANIZATION_ENTITIES_STORE');
