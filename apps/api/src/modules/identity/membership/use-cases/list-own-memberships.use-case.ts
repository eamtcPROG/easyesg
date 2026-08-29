import type { AccountMembershipStore } from '../interfaces/account-membership-store.interface';
import type { AccountMembershipView } from '../models/membership.model';

export interface ListOwnMembershipsCommand {
  readonly accountId: string;
  /**
   * The organization THIS request resolved to — `AuthGuard`'s `selectActiveMembership` answer,
   * carried on the request context and supplied by the service, exactly as the account is.
   *
   * Null is a real value with two distinguishable causes the caller can tell apart from the list
   * itself: an account belonging to nothing (empty list), and an account holding several
   * memberships with no stated preference (several rows, none marked). Neither is an error.
   */
  readonly activeOrganizationId: string | null;
}

/**
 * UC-16's *view memberships* half (FR-12) — which organizations this account belongs to, and
 * which of them the request is acting for.
 *
 * `design_spec.md` OQ-6 split UC-16 by behaviour rather than assigning it twice: **S-05 owns
 * viewing** the list, and the global-tier switcher owns *switching*. This is the viewing half, and
 * it is deliberately not the switching half — nothing here writes
 * `identity.session.active_organization_id`. The write is task 83's `PUT /session/organization`.
 *
 * **The `active` marker is a projection, not a second resolution** (task 30.1). It compares each
 * row against a value the guard already computed for this request; this use case never calls
 * `selectActiveMembership` itself, because a second caller of that function is a second place the
 * rule can drift. `AccountMembershipView`'s docblock carries the decision and what it reverses.
 *
 * **An empty list is a real answer, not a not-found.** It is what tells task 25.4's §4.3 branch to
 * send someone to S-04 and create their first organization, and a verified account with no
 * membership is the ordinary state immediately after UC-01.
 *
 * Neither command field may be supplied from the wire: both are the *authenticated* request's,
 * resolved from context by the service. An account id in the body would make this endpoint an
 * answer to "which organizations does that person belong to", and an organization id in the body
 * would make the marker a claim the caller can make about themselves.
 */
export class ListOwnMemberships {
  constructor(private readonly store: AccountMembershipStore) {}

  async execute(command: ListOwnMembershipsCommand): Promise<AccountMembershipView[]> {
    const memberships = await this.store.listForAccount(command.accountId);
    return memberships.map((membership) => ({
      ...membership,
      // `activeOrganizationId` null marks nothing, which is the point: `===` against null is false
      // for every row, and no row is silently promoted to current.
      active: membership.organizationId === command.activeOrganizationId,
    }));
  }
}
