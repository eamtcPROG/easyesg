import { Inject, Injectable } from '@nestjs/common';
import { PUSH_EVENT, PUSH_HINTS, type PushHints } from '@api/contracts/push.port';
import { ChangeMemberRole, type ChangeMemberRoleCommand } from '../use-cases/change-member-role.use-case';
import { ListMembers } from '../use-cases/list-members.use-case';
import { ListOwnMemberships } from '../use-cases/list-own-memberships.use-case';
import { RemoveMember, type RemoveMemberCommand } from '../use-cases/remove-member.use-case';
import {
  SwitchActiveOrganization,
  type SwitchActiveOrganizationCommand,
} from '../use-cases/switch-active-organization.use-case';
import { AuthenticationRequiredError } from '../errors/membership.errors';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { AccountMembershipView, OrganizationMember } from '../models/membership.model';

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
 * **`switchActive` is the second** (task 83.1), and resolves the session beside the account.
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly listMembers: ListMembers,
    private readonly listOwnMemberships: ListOwnMemberships,
    private readonly changeMemberRole: ChangeMemberRole,
    private readonly removeMemberUseCase: RemoveMember,
    private readonly switchActiveOrganization: SwitchActiveOrganization,
    @Inject(PUSH_HINTS) private readonly hints: PushHints,
  ) {}

  /** S-16's list changed (task 148): hinted on the request's own transaction, after the use case succeeded. */
  private async accessChanged(): Promise<void> {
    const organizationId = requestContext()?.organizationId;
    if (!organizationId) throw new AuthenticationRequiredError();
    await this.hints.hint({ event: PUSH_EVENT.ACCESS_CHANGED, organizationId });
  }

  list(): Promise<OrganizationMember[]> {
    return this.listMembers.execute();
  }

  /**
   * `RequiresAccountGuard` has already refused a request with no actor, so reaching this with none
   * is a route that forgot `@RequiresAccount`. It throws rather than trusting that — the guard is a
   * declaration and this is the layer that would otherwise ask the database for the memberships of
   * `undefined`, which RLS answers with an empty list rather than an error.
   *
   * **`organizationId` is resolved here for the same reason `actorId` is** (task 30.1): it is
   * ambient request context, and this is the layer that owns resolving it. It is `AuthGuard`'s
   * `selectActiveMembership` answer, already computed for this request — so the `active` marker the
   * switcher and the global bar read is that one resolution projected, never a second one. It is
   * `undefined` on a session that has chosen nothing, and `?? null` is the only place that becomes
   * a value: the use case's contract is `string | null`, because "not chosen" is an answer and
   * `undefined` is the absence of one.
   */
  listOwn(): Promise<AccountMembershipView[]> {
    const context = requestContext();
    const accountId = context?.actorId;
    if (!accountId) throw new AuthenticationRequiredError();
    return this.listOwnMemberships.execute({
      accountId,
      activeOrganizationId: context?.organizationId ?? null,
    });
  }

  /**
   * **The session is resolved here for the reason the account is**: a session id from the wire would
   * let a caller name which session to move. Reaching this with either missing is a wiring defect
   * rather than a request — `AuthGuard` sets both — so it is refused as a 401 rather than asserted.
   */
  switchActive(
    input: Omit<SwitchActiveOrganizationCommand, 'accountId' | 'sessionId'>,
  ): Promise<void> {
    const context = requestContext();
    if (context?.actorId === undefined || context.sessionId === undefined) {
      throw new AuthenticationRequiredError();
    }
    return this.switchActiveOrganization.execute({
      organizationId: input.organizationId,
      accountId: context.actorId,
      sessionId: context.sessionId,
    });
  }

  async changeRole(command: ChangeMemberRoleCommand): Promise<void> {
    await this.changeMemberRole.execute(command);
    await this.accessChanged();
  }

  async remove(command: RemoveMemberCommand): Promise<void> {
    await this.removeMemberUseCase.execute(command);
    await this.accessChanged();
  }
}
