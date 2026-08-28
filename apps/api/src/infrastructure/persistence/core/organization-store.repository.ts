import { Injectable } from '@nestjs/common';
import type { OrganizationStore } from '@api/modules/core/organization/interfaces/organization-store.interface';
import type {
  Organization,
  OrganizationProfilePatch,
} from '@api/modules/core/organization/models/organization.model';
import { TenantRepository } from '../tenant-repository';
import { AmbiguousBoundOrganizationError } from '@api/modules/core/organization/errors/organization.errors';

/** Rows as PostgreSQL returns them: snake_case, `timestamptz` already parsed to `Date` by `pg`. */
interface OrganizationRow {
  id: string;
  name: string;
  country_code: string;
  legal_form: string | null;
  idno: string | null;
  lei: string | null;
  registered_address_line1: string | null;
  registered_address_line2: string | null;
  registered_locality: string | null;
  registered_postal_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: Date;
  updated_at: Date;
}

/** The columns a patch may name, paired with the model field each maps from. One list, two uses. */
const PATCHABLE = {
  name: 'name',
  countryCode: 'country_code',
  legalForm: 'legal_form',
  idno: 'idno',
  lei: 'lei',
  registeredAddressLine1: 'registered_address_line1',
  registeredAddressLine2: 'registered_address_line2',
  registeredLocality: 'registered_locality',
  registeredPostalCode: 'registered_postal_code',
  contactEmail: 'contact_email',
  contactPhone: 'contact_phone',
} as const satisfies Record<keyof OrganizationProfilePatch, string>;

const SELECTED_COLUMNS = `id, name, country_code, legal_form, idno, lei,
        registered_address_line1, registered_address_line2, registered_locality,
        registered_postal_code, contact_email, contact_phone, created_at, updated_at`;

const toOrganization = (row: OrganizationRow): Organization => ({
  id: row.id,
  name: row.name,
  countryCode: row.country_code,
  legalForm: row.legal_form,
  idno: row.idno,
  lei: row.lei,
  registeredAddressLine1: row.registered_address_line1,
  registeredAddressLine2: row.registered_address_line2,
  registeredLocality: row.registered_locality,
  registeredPostalCode: row.registered_postal_code,
  contactEmail: row.contact_email,
  contactPhone: row.contact_phone,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * The `OrganizationStore` adapter — UC-50 over the tenant root.
 *
 * **No statement below names an organization, and none may.** `core.organization`'s policy is `id =
 * app.current_org`, so "the bound organization" is the only row these can reach; a `WHERE id = $1`
 * would be a second source of tenancy drifting from the policy the moment either changed. It is
 * `MembershipStoreRepository`'s rule on the one table where the policy is written against `id`
 * rather than `organization_id`, which changes nothing about the rule.
 *
 * **Both statements plan as a sequential scan, and that is structural rather than a size effect**
 * (measured on PostgreSQL 18 as `esg_app`, not assumed). The tenant root carries three permissive
 * `SELECT` policies — the bound tenant, task 26.2's invitation bearer, task 25.3's directory — and
 * permissive policies are OR'd, so the predicate is a disjunction with two subplans and cannot be
 * answered from the primary key however many rows there are. It is the right cost at this scale:
 * the envelope is ≤2,000 organizations of a few hundred bytes, read once per profile screen. It is
 * recorded because the obvious future reaction — adding an index — would buy nothing, and the
 * change that *would* matter is narrowing the policy set, which those two tasks own.
 *
 * **The `UPDATE` is built from a column allowlist, not from the patch's keys.** The patch is a
 * validated DTO, so its keys are already bounded — but a column name cannot be a bind parameter, so
 * the safe property has to come from a list in this file rather than from what arrived. `PATCHABLE`
 * is `satisfies Record<keyof OrganizationProfilePatch, string>`, which is what makes a field added
 * to the model a compile error here instead of a column that silently never saves.
 */
@Injectable()
export class OrganizationStoreRepository
  extends TenantRepository<never>
  implements OrganizationStore
{
  protected readonly entity = 'core.organization' as never;

  async findBoundOrganization(): Promise<Organization | null> {
    const rows = await this.manager.query<OrganizationRow[]>(
      `SELECT ${SELECTED_COLUMNS} FROM core.organization`,
    );

    // **More than one row is a bug, not a case to pick from** — and today it is unreachable, which
    // is exactly why the check is here rather than a comment saying so.
    //
    // Three permissive `SELECT` policies stand on this table and permissive policies are OR'd: the
    // bound tenant (`id = app.current_org`), task 25.3's directory (gated on `app.current_org IS
    // NULL`, so inert here) and task 26.2's invitation bearer (gated on `app.current_invitation`,
    // which only that store binds, on a transaction of its own). Singularity is therefore a
    // property of *other tasks' policies*, not of this statement — and the first flow that binds an
    // invitation on the request transaction, which is what a signed-in user previewing an
    // invitation is, would hand an administrator of one organization the profile of another.
    //
    // Taking `rows[0]` would make that a silent cross-tenant read with RLS behaving exactly as
    // instructed, invisible to AD-2's probes. Throwing makes it a loud failure instead, in the same
    // spirit as `TenantRepository`'s throw on a missing context: a wrong answer nobody can see is
    // worse than an error somebody must fix.
    if (rows.length > 1) {
      throw new AmbiguousBoundOrganizationError(rows.length);
    }
    return rows.length > 0 ? toOrganization(rows[0]) : null;
  }

  async updateProfile(patch: OrganizationProfilePatch, at: Date): Promise<Organization | null> {
    const assignments: string[] = [];
    const parameters: unknown[] = [];

    for (const [field, column] of Object.entries(PATCHABLE)) {
      const value = patch[field as keyof OrganizationProfilePatch];
      // `undefined` is "absent from the patch"; `null` is "clear it". The model draws that
      // distinction and this is the one loop that has to honour it — `if (value)` would silently
      // refuse to clear a field and `!= null` would refuse to write an empty one.
      if (value === undefined) continue;
      parameters.push(value);
      assignments.push(`${column} = $${parameters.length}`);
    }

    // An empty patch is a no-op read rather than an error: S-15 saving a form nobody edited is an
    // ordinary thing for a person to do, and `SET` with no assignment is a syntax error.
    if (assignments.length === 0) return this.findBoundOrganization();

    parameters.push(at);
    assignments.push(`updated_at = $${parameters.length}`);

    // `UPDATE ... RETURNING` gives `[rows, rowCount]` rather than the rows — TypeORM builds `raw`
    // with a switch on the driver's `command`, so the identical clause reads differently after an
    // INSERT. Normalised here rather than remembered; see `returnedRows` in the identity stores.
    const result = await this.manager.query<[OrganizationRow[], number]>(
      `UPDATE core.organization SET ${assignments.join(', ')} RETURNING ${SELECTED_COLUMNS}`,
      parameters,
    );
    const [rows] = result;
    return rows.length > 0 ? toOrganization(rows[0]) : null;
  }
}
