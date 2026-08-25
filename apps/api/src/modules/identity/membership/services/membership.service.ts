import { Injectable } from '@nestjs/common';
import { ChangeMemberRole, type ChangeMemberRoleCommand } from '../use-cases/change-member-role.use-case';
import { ListMembers } from '../use-cases/list-members.use-case';
import { RemoveMember, type RemoveMemberCommand } from '../use-cases/remove-member.use-case';
import type { OrganizationMember } from '../models/membership.model';

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
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly listMembers: ListMembers,
    private readonly changeMemberRole: ChangeMemberRole,
    private readonly removeMemberUseCase: RemoveMember,
  ) {}

  list(): Promise<OrganizationMember[]> {
    return this.listMembers.execute();
  }

  changeRole(command: ChangeMemberRoleCommand): Promise<void> {
    return this.changeMemberRole.execute(command);
  }

  remove(command: RemoveMemberCommand): Promise<void> {
    return this.removeMemberUseCase.execute(command);
  }
}
