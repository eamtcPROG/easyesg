import type { NewOrganization, Organization } from '../models/organization.model';

/**
 * UC-49's write, and the counterpart to `OrganizationStore` in the way `AccountMembershipStore` is
 * to `MembershipStore`: the same aggregate, read at a moment when no tenant exists.
 *
 * **It must open its own transaction, and a shared one would be wrong twice over.** The
 * organization being created has no id until the `INSERT` returns, so no context could have been
 * bound before the request began — and where the caller already has one bound (an existing member
 * founding a second organization), the request's transaction is bound to the *wrong* organization,
 * under which `membership_tenant_insert` refuses the founding grant. Neither is a case a borrowed
 * runner can serve.
 */
export interface OrganizationFoundingStore {
  /**
   * FR-13 in one transaction: the organization, and the membership that makes its creator the
   * Organization Administrator (D-1).
   *
   * **One transaction is the requirement, not a convenience.** An organization committed without
   * its founding membership is unreachable by everyone including the person who made it — no
   * membership means no `app.current_org`, and RLS then hides the row from every query in the
   * system. There is no screen that repairs it and no support route that could, short of a
   * `esg_admin_ro` investigation and a hand-written migration.
   */
  createWithFoundingAdministrator(input: {
    readonly organization: NewOrganization;
    readonly founderAccountId: string;
  }): Promise<Organization>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const ORGANIZATION_FOUNDING_STORE = Symbol('ORGANIZATION_FOUNDING_STORE');
