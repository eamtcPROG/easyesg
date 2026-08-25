import { Injectable } from '@nestjs/common';
import { ChangeMemberRole, type ChangeMemberRoleCommand } from '../use-cases/change-member-role.use-case';
import { ListMembers } from '../use-cases/list-members.use-case';
import { ListOwnMemberships } from '../use-cases/list-own-memberships.use-case';
import { RemoveMember, type RemoveMemberCommand } from '../use-cases/remove-member.use-case';
import { AuthenticationRequiredError } from '../errors/membership.errors';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { AccountMembership, OrganizationMember } from '../models/membership.model';

/**
 * The Nest-aware seam between `MembersController` and the use cases (house rule, 20 Aug 2026:
 * controllers call services, services call use cases).
 *
 * Every method here is currently a single call, and that is the honest minimum rather than the
 * pass-through `CLAUDE.md` warns against — the seam is the rule. It is also where the ambient
 * request context would be resolved if these use cases needed any, as `AccountService` resolves the
 * negotiated locale. They need none: the organization comes from RLS and the actor from
 * `app.current_user`, both bound to the transaction before this is reached, so there is nothing for
 * a caller to supply and nothing for this layer to add.
 *
 * The commands are taken whole rather than destructured into parameters, so a field added to one
 * arrives here without touching this file (CLAUDE.md, "An application-boundary call takes one
 * object").
 *
 * **`listOwn` is the exception that proves the paragraph above**, added with task 25.3: it resolves
 * the acting account from the request context and supplies it to the use case, exactly as
 * `AccountService` resolves the negotiated locale. That resolution has to happen at this layer
 * precisely so it cannot happen at the layer above — an account id arriving in a query string would
 * turn "my organizations" into "that person's organizations", and the endpoint would answer it.
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly listMembers: ListMembers,
    private readonly listOwnMemberships: ListOwnMemberships,
    private readonly changeMemberRole: ChangeMemberRole,
    private readonly removeMemberUseCase: RemoveMember,
  ) {}

  list(): Promise<OrganizationMember[]> {
    return this.listMembers.execute();
  }

  /**
   * `RequiresAccountGuard` has already refused a request with no actor, so reaching this with none
   * is a route that forgot `@RequiresAccount`. It throws rather than trusting that — the guard is a
   * declaration and this is the layer that would otherwise ask the database for the memberships of
   * `undefined`, which RLS answers with an empty list rather than an error.
   */
  listOwn(): Promise<AccountMembership[]> {
    const accountId = requestContext()?.actorId;
    if (!accountId) throw new AuthenticationRequiredError();
    return this.listOwnMemberships.execute({ accountId });
  }

  changeRole(command: ChangeMemberRoleCommand): Promise<void> {
    return this.changeMemberRole.execute(command);
  }

  remove(command: RemoveMemberCommand): Promise<void> {
    return this.removeMemberUseCase.execute(command);
  }
}
