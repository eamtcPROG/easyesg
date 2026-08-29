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
  report_contact_name: string | null;
  report_contact_email: string | null;
  created_at: Date;
  updated_at: Date;
  /** From the lateral join below, not from `core.organization`. Null on a record with no trail. */
  last_changed_at: Date | null;
  last_actor_id: string | null;
  last_actor_email: string | null;
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
  reportContactName: 'report_contact_name',
  reportContactEmail: 'report_contact_email',
} as const satisfies Record<keyof OrganizationProfilePatch, string>;

const SELECTED_COLUMNS = `o.id, o.name, o.country_code, o.legal_form, o.idno, o.lei,
        o.registered_address_line1, o.registered_address_line2, o.registered_locality,
        o.registered_postal_code, o.contact_email, o.contact_phone,
        o.report_contact_name, o.report_contact_email, o.created_at, o.updated_at`;

/**
 * FR-15's attribution, answered from the trail that already records it (task 30.3).
 *
 * **A lateral join rather than a second round trip**, and the ordering is not a guess: task 14's
 * `field_change_record_idx` is `(organization_id, table_name, record_id, occurred_at DESC)`, so
 * this reads one row from an index whose leading column RLS supplies. That is also why no `WHERE`
 * here names an organization — the policy is `organization_id = app.current_org`.
 *
 * **`table_name` is schema-qualified** because the trigger writes `TG_TABLE_SCHEMA || '.' ||
 * TG_TABLE_NAME`. A bare `'organization'` matches nothing and would silently answer "never
 * changed", which is the shape of wrong answer an RLS-scoped read keeps producing here.
 *
 * **The join to `identity.account` is LEFT and reads no wider than the trail.**
 * `core.field_change.actor_id` carries no foreign key by design (task 14 — an attribution must
 * outlive the account it names), so a since-erased actor yields a null address rather than dropping
 * the row. `identity.account` carries no RLS, which sounds like a widening and is not: the trail is
 * already scoped to the bound organization, so the only accounts reachable through it are the ones
 * that changed *this* organization — its own members, whose addresses S-16 shows the same reader.
 */
const LAST_CHANGE_JOIN = `LEFT JOIN LATERAL (
          SELECT fc.occurred_at, fc.actor_id, a.email
            FROM core.field_change fc
            LEFT JOIN identity.account a ON a.id = fc.actor_id
           WHERE fc.table_name = 'core.organization' AND fc.record_id = o.id
           ORDER BY fc.occurred_at DESC
           LIMIT 1
        ) lc ON true`;

const LAST_CHANGE_COLUMNS = `lc.occurred_at AS last_changed_at,
        lc.actor_id AS last_actor_id, lc.email AS last_actor_email`;

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
  reportContactName: row.report_contact_name,
  reportContactEmail: row.report_contact_email,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // The moment is what makes an attribution one: an actor with no time answers nothing, so the
  // whole object is absent rather than half filled. A *named* actor is the optional half.
  lastChange:
    row.last_changed_at === null
      ? null
      : { accountId: row.last_actor_id, email: row.last_actor_email, at: row.last_changed_at },
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
      `SELECT ${SELECTED_COLUMNS}, ${LAST_CHANGE_COLUMNS}
         FROM core.organization o
         ${LAST_CHANGE_JOIN}`,
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
    const result = await this.manager.query<[{ id: string }[], number]>(
      `UPDATE core.organization SET ${assignments.join(', ')} RETURNING id`,
      parameters,
    );
    const [rows] = result;
    if (rows.length === 0) return null;

    // **Re-read rather than `RETURNING` the whole row**, because the attribution this write just
    // produced is the answer the screen needs. `core.capture_field_change` is an `AFTER` trigger,
    // so its rows exist by the time this statement returns and are visible on the same transaction
    // — but they cannot appear in a `RETURNING` clause, which sees the updated row and nothing
    // else. One extra round trip on a write, rather than rendering "last changed" as the state
    // before the change the reader has just made.
    return this.findBoundOrganization();
  }
}
