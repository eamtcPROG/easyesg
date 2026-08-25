import type { AccountMembershipStore } from '../interfaces/account-membership-store.interface';
import type { AccountMembership } from '../models/membership.model';

export interface ListOwnMembershipsCommand {
  readonly accountId: string;
}

/**
 * UC-16's *view memberships* half (FR-12) — which organizations this account belongs to.
 *
 * `design_spec.md` OQ-6 split UC-16 by behaviour rather than assigning it twice: **S-05 owns
 * viewing** the list, and the global-tier switcher owns *switching*, which is task 30.1. This is
 * the viewing half, and it is deliberately not the switching half — nothing here writes
 * `identity.session.active_organization_id`.
 *
 * **An empty list is a real answer, not a not-found.** It is what tells task 25.4's §4.3 branch to
 * send someone to S-04 and create their first organization, and a verified account with no
 * membership is the ordinary state immediately after UC-01.
 *
 * A single-field command is still an object (CLAUDE.md, "Conventions"). It is also the one field a
 * caller must not supply from the wire: the account is the *authenticated* one, resolved from the
 * request context by the service, never a parameter — an account id in the body would make this
 * endpoint an answer to "which organizations does that person belong to".
 */
export class ListOwnMemberships {
  constructor(private readonly store: AccountMembershipStore) {}

  async execute(command: ListOwnMembershipsCommand): Promise<AccountMembership[]> {
    return this.store.listForAccount(command.accountId);
  }
}
