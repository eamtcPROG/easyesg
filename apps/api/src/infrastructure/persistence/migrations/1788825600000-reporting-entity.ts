import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-17, FR-18 and FR-20 — the reporting entity, its sites, and the point-in-time snapshot
 * (task 29.3; UC-52, UC-53, UC-55).
 *
 * **The first `core` tables that are not the tenant root**, so they are the first to carry
 * `organization_id` and the ordinary two-clause policy rather than task 12's `id`-scoped exception.
 *
 * **Each carries `UNIQUE (id, organization_id)` and each child references the pair**, which is
 * §7.3's structural note applied where it first bites. A child row's `organization_id` is *tied* to
 * its parent's rather than merely copied: without the composite foreign key a wrong value would
 * hide a site from its own tenant or expose it to another, and RLS would faithfully enforce
 * whatever the column said.
 */
export class ReportingEntity1788825600000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so the four cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  private tenantPolicies(table: string, name: string): string[] {
    return [
      `CREATE POLICY ${name}_tenant_select ON ${table}
         FOR SELECT USING (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY ${name}_tenant_insert ON ${table}
         FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY ${name}_tenant_update ON ${table}
         FOR UPDATE USING (organization_id = ${this.boundOrganization})
                 WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY ${name}_tenant_delete ON ${table}
         FOR DELETE USING (organization_id = ${this.boundOrganization})`,
    ];
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── FR-17: the entity ─────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE core.reporting_entity (
        id              uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id uuid        NOT NULL REFERENCES core.organization (id) ON DELETE CASCADE,
        name            text        NOT NULL,
        legal_form      text,
        nace_codes      text[]      NOT NULL DEFAULT '{}',
        status          text        NOT NULL DEFAULT 'active',
        archived_at     timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),

        -- FR-20's two states. An archived entity leaves active selection and keeps its history, so
        -- this is a status change and never a delete — task 25.1's rule for memberships, and the
        -- same reason: the row is the history.
        CONSTRAINT reporting_entity_status_known CHECK (status IN ('active', 'archived')),
        CONSTRAINT reporting_entity_archived_at_matches_status
          CHECK ((status = 'archived') = (archived_at IS NOT NULL)),

        -- Keys, not sentences — the same guarantee the organization's legal form carries, and for
        -- the same reason: the permitted values are configuration (§7.2), so the database checks
        -- the shape and the application admits the value.
        CONSTRAINT reporting_entity_legal_form_key CHECK (legal_form ~ '^[a-z][a-z0-9_]*$'),

        -- §7.3's composite-FK target. Every child ties its tenant to this row's rather than
        -- carrying an independent copy.
        UNIQUE (id, organization_id)
      )
    `);

    // ── FR-17: sites, which B1 discloses and B5's applicability is evaluated from ──────────────
    //
    // **Coordinates are `numeric`, never `float`** (NFR-58, and the schema-invariant gate enforces
    // it). BR-APP-3 makes biodiversity applicability site-driven, evaluated from these
    // geolocations, so a value that drifts in the last places is a determination that changes.
    // `numeric(9,6)` holds any terrestrial coordinate to roughly a tenth of a metre.
    await queryRunner.query(`
      CREATE TABLE core.site (
        id                  uuid          PRIMARY KEY DEFAULT uuidv7(),
        organization_id     uuid          NOT NULL,
        reporting_entity_id uuid          NOT NULL,
        name                text          NOT NULL,
        address_line1       text,
        locality            text,
        postal_code         text,
        country_code        text,
        latitude            numeric(9, 6),
        longitude           numeric(9, 6),
        created_at          timestamptz   NOT NULL DEFAULT now(),
        updated_at          timestamptz   NOT NULL DEFAULT now(),

        CONSTRAINT site_country_code_iso CHECK (country_code ~ '^[A-Z]{2}$'),
        CONSTRAINT site_latitude_range  CHECK (latitude  BETWEEN -90  AND 90),
        CONSTRAINT site_longitude_range CHECK (longitude BETWEEN -180 AND 180),
        -- A half-entered coordinate is not a location. Either both or neither.
        CONSTRAINT site_coordinates_paired CHECK ((latitude IS NULL) = (longitude IS NULL)),

        FOREIGN KEY (reporting_entity_id, organization_id)
          REFERENCES core.reporting_entity (id, organization_id) ON DELETE CASCADE,
        UNIQUE (id, organization_id)
      )
    `);

    // ── FR-18: the point-in-time snapshot ─────────────────────────────────────────────────────
    //
    // **Nothing writes this table until task 31.1 opens a period** (§7.2: "the snapshot is taken at
    // period open and referenced by the report"). It is built now for `core.org_relationship`'s
    // reason — adding it later is a migration against a live filing window, which NFR-48 forbids in
    // April and May — and that is the second empty table in three tasks, which is worth saying out
    // loud rather than letting accumulate quietly.
    //
    // **`jsonb`, unlike every other table here, and deliberately.** A snapshot is a frozen document
    // read back whole; it is not queried per field and never edited, so the per-column modelling
    // that FR-54's audit trail needs elsewhere buys nothing. What it must resist is *change*, which
    // is the next paragraph rather than the column type.
    await queryRunner.query(`
      CREATE TABLE core.entity_snapshot (
        id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id     uuid        NOT NULL,
        reporting_entity_id uuid        NOT NULL,
        taken_at            timestamptz NOT NULL DEFAULT now(),
        payload             jsonb       NOT NULL,

        FOREIGN KEY (reporting_entity_id, organization_id)
          REFERENCES core.reporting_entity (id, organization_id) ON DELETE CASCADE,
        UNIQUE (id, organization_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX site_entity_idx ON core.site (organization_id, reporting_entity_id)
    `);
    await queryRunner.query(`
      CREATE INDEX entity_snapshot_entity_idx
        ON core.entity_snapshot (organization_id, reporting_entity_id, taken_at DESC)
    `);

    // ── Grants ────────────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON core.reporting_entity, core.site TO esg_app
    `);
    // **No UPDATE and no DELETE on the snapshot, for any runtime role.** FR-18's guarantee is that a
    // closed period keeps the values in force when it was prepared; a snapshot the application could
    // rewrite would defeat exactly that, and privilege is the layer that makes it structural rather
    // than a convention every future query author has to remember (§7.7's posture, applied to a
    // table that is not in the `audit` schema).
    await queryRunner.query(`GRANT SELECT, INSERT ON core.entity_snapshot TO esg_app`);
    await queryRunner.query(`
      GRANT SELECT ON core.reporting_entity, core.site, core.entity_snapshot
        TO esg_worker, esg_admin_ro
    `);

    // ── RLS ───────────────────────────────────────────────────────────────────────────────────
    for (const table of ['core.reporting_entity', 'core.site', 'core.entity_snapshot']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
    for (const statement of [
      ...this.tenantPolicies('core.reporting_entity', 'reporting_entity'),
      ...this.tenantPolicies('core.site', 'site'),
      // The snapshot has no UPDATE or DELETE policy, matching its grants: two layers saying the
      // same thing, which is what task 26.1's cleanup note found is worth having.
      `CREATE POLICY entity_snapshot_tenant_select ON core.entity_snapshot
         FOR SELECT USING (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY entity_snapshot_tenant_insert ON core.entity_snapshot
         FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})`,
    ]) {
      await queryRunner.query(statement);
    }

    // ── FR-54's per-field capture ─────────────────────────────────────────────────────────────
    //
    // On the two mutable tables. The snapshot is deliberately absent and is classified as such in
    // the invariant gate: it is immutable by grant, so capturing per-field changes to it would
    // record the writing of a record — `audit.system_audit_log`'s argument in a different schema.
    for (const table of ['core.reporting_entity', 'core.site']) {
      await queryRunner.query(`
        CREATE TRIGGER capture_field_change
          AFTER INSERT OR UPDATE OR DELETE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Triggers, policies, grants and indexes all go with the tables; children first.
    await queryRunner.query(`DROP TABLE core.entity_snapshot`);
    await queryRunner.query(`DROP TABLE core.site`);
    await queryRunner.query(`DROP TABLE core.reporting_entity`);
  }
}
