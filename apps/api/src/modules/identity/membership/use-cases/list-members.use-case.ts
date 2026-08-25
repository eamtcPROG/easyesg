import type { MembershipStore } from '../interfaces/membership-store.interface';
import type { OrganizationMember } from '../models/membership.model';

/**
 * UC-59 — view the organization's users and access levels (FR-56).
 *
 * *"This is the single place where 'who can see our ESG data' is answerable"*, which is why the
 * list is the whole use case and there is nothing else in it: no filter, no sort, no page. The
 * collection is bounded by the plan's seat entitlement (§6.10), and
 * `GlobalResponseInterceptor` already treats a bare array as "one page containing all of it", so
 * pagination here would be query grammar published into the contract with no reader — and S-16's
 * Index archetype can satisfy its filter and sort elements client-side over a set this size.
 *
 * **The organization is never a parameter.** RLS scopes the read to `app.current_org`; passing one
 * would be the second source of tenancy AD-2 and UX-2 forbid.
 */
export class ListMembers {
  constructor(private readonly store: MembershipStore) {}

  async execute(): Promise<OrganizationMember[]> {
    return this.store.listActiveMembers();
  }
}
