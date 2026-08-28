import type { Organization, OrganizationProfilePatch } from '../models/organization.model';

/**
 * The **tenant-scoped** half of the organization aggregate — UC-50's read and edit.
 *
 * Like `MembershipStore` and for the same reason, it has no `run()`: this is tenant data, so
 * AD-14 constraint 2 puts every query on the **request's** `QueryRunner`, the one carrying
 * `app.current_org`. A second transaction here could commit while the request's rolled back.
 *
 * **Nothing below takes an organization id.** RLS scopes every statement to `app.current_org`, and
 * `core.organization`'s policy is the tenant root's — `id = app.current_org` — so "the bound
 * organization" is the only row these can reach. A parameter would be a second, contradictory
 * source of tenancy of exactly the kind AD-2 and UX-2 forbid.
 */
export interface OrganizationStore {
  /** UC-50's read. Null when nothing is bound, which RLS makes the same as "not yours". */
  findBoundOrganization(): Promise<Organization | null>;

  /**
   * UC-50's edit (FR-15). Returns the row as it stands after the write, or null when the patch
   * reached nothing.
   *
   * **The attribution and the timestamp are not this method's job**, and that is worth stating
   * because FR-15 asks for both. `core.capture_field_change` writes one `core.field_change` row per
   * column that moved, taking the actor from `app.current_user` — which the request transaction has
   * already bound. A hand-rolled history here would be a second, divergent trail.
   */
  updateProfile(patch: OrganizationProfilePatch, at: Date): Promise<Organization | null>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const ORGANIZATION_STORE = Symbol('ORGANIZATION_STORE');
