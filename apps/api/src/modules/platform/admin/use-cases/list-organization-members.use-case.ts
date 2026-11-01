import { OrganizationNotRegisteredError } from '../errors/organization-register.errors';
import type { OrganizationMembersStore } from '../interfaces/organization-members-store.interface';
import type { OrganizationMember } from '../models/organization-member.model';

export interface ListOrganizationMembersCommand {
  readonly organizationId: string;
  /** The operator reading — the acquisition log's requester (FR-79), from `AdminRealmGuard`. */
  readonly requesterId: string;
}

/**
 * The people of one organization, as A-02's record lists them (task 167; UC-69; §12.5.6's task-167 row) — name,
 * sign-in address, role, and whether a phone was given, so support can find the person an account belongs to. The
 * phones themselves are `DiscloseMemberPhone`'s, one at a time.
 */
export class ListOrganizationMembers {
  constructor(private readonly store: OrganizationMembersStore) {}

  async execute(command: ListOrganizationMembersCommand): Promise<readonly OrganizationMember[]> {
    const members = await this.store.members(command);
    if (members === null) throw new OrganizationNotRegisteredError();
    return members;
  }
}
