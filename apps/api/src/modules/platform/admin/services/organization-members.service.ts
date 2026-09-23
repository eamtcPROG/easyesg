import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import type { OrganizationMember } from '../models/organization-member.model';
import { DiscloseMemberPhone } from '../use-cases/disclose-member-phone.use-case';
import { ListOrganizationMembers } from '../use-cases/list-organization-members.use-case';

/**
 * The seam between `OrganizationMembersController` and task 167's two use cases — resolving **who is reading**, for
 * the acquisition log, as `OrganizationRegisterService` does, and refusing a request with none rather than trusting
 * the guard that already would have.
 */
@Injectable()
export class OrganizationMembersService {
  constructor(
    private readonly listMembers: ListOrganizationMembers,
    private readonly disclosePhone: DiscloseMemberPhone,
  ) {}

  members(input: { readonly organizationId: string }): Promise<readonly OrganizationMember[]> {
    return this.listMembers.execute({ ...input, requesterId: requester() });
  }

  phone(input: { readonly organizationId: string; readonly accountId: string }): Promise<{ readonly phone: string }> {
    return this.disclosePhone.execute({ ...input, requesterId: requester() });
  }
}

const requester = (): string => {
  const requesterId = requestContext()?.adminAccountId;
  if (!requesterId) throw new AdminSessionInvalidError();
  return requesterId;
};
