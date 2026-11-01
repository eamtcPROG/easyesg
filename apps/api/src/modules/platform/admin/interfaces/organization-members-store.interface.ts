import type { OrganizationMember } from '../models/organization-member.model';

/** Which organization's members, and who is reading — the acquisition log's requester (FR-79). */
export interface OrganizationMembersRead {
  readonly organizationId: string;
  /** `adminAccountId` from `AdminRealmGuard` — never a tenant actor. */
  readonly requesterId: string;
}

/** One member's phone, and who is reading it. */
export interface MemberPhoneRead extends OrganizationMembersRead {
  readonly accountId: string;
}

/**
 * A-02's record's people (task 167; §12.5.6's task-167 row). **Its adapter reads through `esg_admin_ro` and logs
 * the acquisition before it does**, as the register's store does, which is why the requester is part of every read.
 * A port of its own rather than two more methods on the register's: its readers are the record's, not the register's.
 */
export interface OrganizationMembersStore {
  /** The organization's active members, in the order a person reads names — or `null` for an id no organization holds. */
  members(read: OrganizationMembersRead): Promise<readonly OrganizationMember[] | null>;

  /** One active member's phone — `null` when the account is no active member there or gave none. */
  phone(read: MemberPhoneRead): Promise<string | null>;
}

export const ORGANIZATION_MEMBERS_STORE = Symbol('ORGANIZATION_MEMBERS_STORE');
