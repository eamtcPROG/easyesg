import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { OrganizationFoundingStore } from '@api/modules/core/organization/interfaces/organization-founding-store.interface';
import type { Organization } from '@api/modules/core/organization/models/organization.model';
import {
  MEMBERSHIP_ROLE,
  MEMBERSHIP_STATUS,
} from '@api/modules/identity/membership/models/membership.model';
import { CORE_DATA_SOURCE } from '../data-source';

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

const RETURNED_COLUMNS = `id, name, country_code, legal_form, idno, lei,
        registered_address_line1, registered_address_line2, registered_locality,
        registered_postal_code, contact_email, contact_phone, created_at, updated_at`;

/**
 * The `OrganizationFoundingStore` adapter — UC-49's two writes in one transaction (FR-13, D-1).
 *
 * **It opens its own transaction and does not extend `TenantRepository`**, which is the third and
 * sharpest of the reasons a store does that (task 26.2 recorded the first two). The organization
 * being created has no id until it exists, so nothing could have bound it; and where the caller
 * already holds an active organization — a bookkeeper founding their second — the request's
 * transaction is bound to the *wrong* one, under which `membership_tenant_insert` refuses the
 * founding grant outright.
 *
 * **The id is minted before the insert, and that ordering is forced by RLS rather than chosen.**
 * PostgreSQL applies the `SELECT` policy to the rows an `INSERT … RETURNING` gives back, and
 * `organization_tenant_select` reads `id = app.current_org`. Minting the id with `uuidv7()` first
 * lets the context be bound to a row that does not exist yet, after which both the `RETURNING` and
 * the membership insert are ordinary scoped statements. The value still comes from PostgreSQL, so
 * §7.9's time-ordered key is unchanged; only the moment it is generated moves.
 *
 * **Measured rather than reasoned about, because the error names the wrong policy** (PostgreSQL 18,
 * as `esg_app`). The same insert *without* `RETURNING` and with nothing bound succeeds — `INSERT 0
 * 1` — while with `RETURNING` it raises `new row violates row-level security policy`. That message
 * describes a `WITH CHECK` failure, and task 12 made this table's `INSERT` policy `WITH CHECK
 * (true)` precisely so FR-13 could work; so anyone debugging it is sent to read a policy doing
 * exactly what it was written to do, while the clause that actually refused is a `SELECT` policy
 * nobody was looking at. The browser suite's fixture (`e2e/web/support/db.ts`) records the same
 * measurement and sidesteps it by generating the id in JavaScript; this path cannot, because §7.9's
 * key must stay time-ordered and `randomUUID()` is a v4.
 *
 * **There are three writes, not two.** The organization, the founding membership, and the session
 * pointed at what was just created. The third is easy to read as a nicety and is not: two
 * memberships with no stated preference resolve to *no* active organization, so omitting it locks
 * an existing member out of the organization they were already using — see the port's header.
 *
 * **`app.current_user` is bound before either write**, and that is FR-15's "attributed" half:
 * `core.capture_field_change` reads the actor from that setting, so binding it afterwards would
 * leave the founding rows attributed to nobody — in the audit trail, permanently, with no way to
 * tell later whether the null meant *unknown* or *the system*.
 */
@Injectable()
export class OrganizationFoundingStoreRepository implements OrganizationFoundingStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async createWithFoundingAdministrator(input: {
    readonly organization: {
      readonly name: string;
      readonly countryCode: string;
      readonly contactEmail: string | null;
      readonly contactPhone: string | null;
    };
    readonly founderAccountId: string;
    readonly sessionId: string;
  }): Promise<Organization> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [{ id }] = (await queryRunner.query('SELECT uuidv7() AS id')) as [{ id: string }];

      // Transaction-local, and by bind parameter — never `SET LOCAL`, which takes none and would
      // force interpolation into the one value tenancy rests on (AD-2).
      await queryRunner.query('SELECT set_config($1, $2, true)', [
        'app.current_user',
        input.founderAccountId,
      ]);
      await queryRunner.query('SELECT set_config($1, $2, true)', ['app.current_org', id]);

      const organization = (await queryRunner.query(
        `INSERT INTO core.organization (id, name, country_code, contact_email, contact_phone)
              VALUES ($1, $2, $3, $4, $5)
           RETURNING ${RETURNED_COLUMNS}`,
        [
          id,
          input.organization.name,
          input.organization.countryCode,
          input.organization.contactEmail,
          input.organization.contactPhone,
        ],
      )) as OrganizationRow[];

      // D-1: the founding user is an Organization Administrator, not a Reporting Contributor.
      // In the same transaction as the row above — an organization committed without this is
      // unreachable by everyone including the person who made it, because no membership means no
      // `app.current_org` and RLS then hides it from every query in the system.
      await queryRunner.query(
        `INSERT INTO identity.membership (account_id, organization_id, role, status)
              VALUES ($1, $2, $3, $4)`,
        [input.founderAccountId, id, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, MEMBERSHIP_STATUS.ACTIVE],
      );

      // The third write, and it belongs in this transaction rather than after it: without it a
      // member of one organization who founds a second is left with two memberships and no stated
      // preference, which `selectActiveMembership` answers with **null** — no active organization
      // at all, on the next request, for the one they were already using.
      //
      // `identity.session` carries no RLS (it belongs to an account, not a tenant), so `account_id`
      // in the predicate is the only thing scoping this write — without it a mistaken session id
      // moves a stranger's active organization and no policy would object. That is
      // `InvitationBearerStoreRepository.setActiveOrganization`'s reasoning, and this is the same
      // column written for the same reason by the other flow that grants a membership.
      await queryRunner.query(
        `UPDATE identity.session SET active_organization_id = $3
          WHERE id = $1 AND account_id = $2`,
        [input.sessionId, input.founderAccountId, id],
      );

      await queryRunner.commitTransaction();

      const row = organization[0];
      return {
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
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Always. A runner released on neither path is a connection never returned to a pool of ten.
      await queryRunner.release();
    }
  }
}
