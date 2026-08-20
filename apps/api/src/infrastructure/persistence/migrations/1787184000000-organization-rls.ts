import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Row-level security on the tenant root (DR-5, AD-2, NFR-63).
 *
 * AD-2 requires cross-tenant access to be **structurally prevented rather than filtered at call
 * sites**, and puts the boundary in PostgreSQL so a forgotten `WHERE` clause cannot open it. Two
 * details below are the difference between that being true and merely looking true.
 *
 * **`FORCE ROW LEVEL SECURITY`, not just `ENABLE`.** A table's owner is exempt from its own
 * policies regardless of `rolbypassrls`, and `esg_migrator` owns every table here (§7.6). With
 * `ENABLE` alone the policies would be silently inert for the owner — and the failure is invisible,
 * because a probe run as the owner passes by seeing everything rather than by being isolated.
 * `FORCE` is what makes the owner subject to them too, and the isolation e2e connects as **both**
 * `esg_app` and `esg_migrator` for exactly this reason.
 *
 * **`NULLIF(..., '')` around the setting.** AD-2 specifies `current_setting('app.current_org',
 * true)` in the `missing_ok` form so an unset context yields NULL and therefore zero rows "rather
 * than a 500 on every endpoint". That holds for *unset* — but a context set to the empty string
 * casts as `invalid input syntax for type uuid` and raises, which is the 500 AD-2 was avoiding,
 * arriving by a route it did not consider. `NULLIF` collapses both cases to the same fail-closed
 * NULL.
 *
 * **Policies are `TO PUBLIC`** — the default, and deliberate. Naming `esg_app, esg_worker` would
 * mean a role added later is unfiltered until someone remembers to alter every policy, and
 * unfiltered is the wrong default for the one boundary the whole tenancy model rests on.
 * `esg_admin_ro` is unaffected regardless: it holds `BYPASSRLS` for the cross-tenant rollups §7.6
 * grants it, with every acquisition logged.
 *
 * **Consequence for future data migrations, stated so it is not rediscovered:** with `FORCE`, a
 * backfill run by `esg_migrator` sees zero rows unless it sets `app.current_org` per organization.
 * A migration that appears to update nothing is this, not an empty table.
 */
export class OrganizationRls1787184000000 implements MigrationInterface {
  /** The tenant root is scoped by its own `id`; every other tenant table by `organization_id`. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE core.organization ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.organization FORCE ROW LEVEL SECURITY`);

    // Read, update and delete are tenant-scoped. Separate per-command policies rather than one
    // FOR ALL: permissive policies are OR'd, so a FOR ALL alongside the INSERT exception below
    // would leave the reader working out which WITH CHECK actually applies to an insert.
    await queryRunner.query(`
      CREATE POLICY organization_tenant_select ON core.organization
        FOR SELECT USING (id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY organization_tenant_update ON core.organization
        FOR UPDATE USING (id = ${this.boundOrganization})
                WITH CHECK (id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY organization_tenant_delete ON core.organization
        FOR DELETE USING (id = ${this.boundOrganization})
    `);

    // The one named exception, and it is confined to this table. FR-13 creates an organization
    // from a verified account that holds no membership yet, so `app.current_org` cannot already
    // equal an id that does not exist — a WITH CHECK here would make organization creation
    // impossible rather than secure. Creating a row you then own is not a cross-tenant violation:
    // what RLS exists to stop is reading or altering somebody else's data, and the three policies
    // above still do. Every other tenant table carries a real WITH CHECK.
    await queryRunner.query(`
      CREATE POLICY organization_insert ON core.organization
        FOR INSERT WITH CHECK (true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY organization_insert ON core.organization`);
    await queryRunner.query(`DROP POLICY organization_tenant_delete ON core.organization`);
    await queryRunner.query(`DROP POLICY organization_tenant_update ON core.organization`);
    await queryRunner.query(`DROP POLICY organization_tenant_select ON core.organization`);
    // NO FORCE is the reverse of FORCE; DISABLE is the reverse of ENABLE. Dropping the policies
    // without these would leave a table with RLS on and no policy, which denies everything.
    await queryRunner.query(`ALTER TABLE core.organization NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.organization DISABLE ROW LEVEL SECURITY`);
  }
}
