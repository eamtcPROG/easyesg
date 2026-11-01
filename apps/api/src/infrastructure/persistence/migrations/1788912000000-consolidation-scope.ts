import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-19's reporting boundary — the consolidation basis and the subsidiaries inside it (task 29.4;
 * UC-54).
 *
 * **The basis is nullable and has no default** (28 Aug 2026, project owner). VSME asks the question
 * explicitly, so a default would answer it on the company's behalf — and answering it wrongly is
 * not a cosmetic error: FR-19 says the boundary bounds *every quantitative figure in the report*, so
 * a group that should have consolidated files individually and every number in it is scoped wrong.
 * What makes the basis required is that a report cannot be filed without one, which is a validation
 * rule interpreted from configuration (FR-73, task 40) — the same place 29.2 put the IDNO's
 * requiredness, and where every other B1 field's enforcement lives.
 *
 * **A member is a named subsidiary, not a pointer to another reporting entity** (same decision). A
 * Moldovan SME's subsidiaries are generally not themselves on the platform, and UC-54 has the
 * Administrator *specifying which subsidiaries are inside the boundary* — a disclosure about the
 * group, which B1 publishes as a list. A pointer can be added later as a nullable column if a use
 * case ever asks for one; modelling both now would ship an abstraction ahead of the second case.
 */
export class ConsolidationScope1788912000000 implements MigrationInterface {
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.reporting_entity ADD COLUMN consolidation_basis text
    `);
    await queryRunner.query(`
      ALTER TABLE core.reporting_entity
        ADD CONSTRAINT reporting_entity_consolidation_basis_known
          CHECK (consolidation_basis IN ('individual', 'consolidated'))
    `);

    // **The subsidiaries are recorded whatever the basis says, and switching to `individual` does
    // not remove them.** Nothing in UC-54 asks for a destructive switch, and this codebase's
    // settled answer to "the state changed" is a status change rather than a delete — membership
    // removal, entity archiving, the snapshot's immutability. B1 reads the basis first and the
    // members only when it says `consolidated`, so an inert list costs nothing and a deleted one
    // cannot be got back.
    await queryRunner.query(`
      CREATE TABLE core.consolidation_member (
        id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id     uuid        NOT NULL,
        reporting_entity_id uuid        NOT NULL,
        name                text        NOT NULL,
        idno                text,
        lei                 text,
        country_code        text,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),

        -- The identifier shapes the organization's own columns carry (task 29.2), for the reason
        -- they carry them: a subsidiary named in B1 is identified to the same standard as the
        -- undertaking naming it, and the check digits are the application's business.
        CONSTRAINT consolidation_member_idno_shape CHECK (idno ~ '^[0-9]{13}$'),
        CONSTRAINT consolidation_member_lei_shape  CHECK (lei  ~ '^[A-Z0-9]{18}[0-9]{2}$'),
        CONSTRAINT consolidation_member_country_code_iso CHECK (country_code ~ '^[A-Z]{2}$'),

        FOREIGN KEY (reporting_entity_id, organization_id)
          REFERENCES core.reporting_entity (id, organization_id) ON DELETE CASCADE,
        UNIQUE (id, organization_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX consolidation_member_entity_idx
        ON core.consolidation_member (organization_id, reporting_entity_id)
    `);

    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON core.consolidation_member TO esg_app
    `);
    await queryRunner.query(`
      GRANT SELECT ON core.consolidation_member TO esg_worker, esg_admin_ro
    `);

    await queryRunner.query(`ALTER TABLE core.consolidation_member ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.consolidation_member FORCE ROW LEVEL SECURITY`);
    for (const [command, clause] of [
      ['SELECT', 'USING'],
      ['INSERT', 'WITH CHECK'],
      ['DELETE', 'USING'],
    ] as const) {
      await queryRunner.query(`
        CREATE POLICY consolidation_member_tenant_${command.toLowerCase()}
          ON core.consolidation_member
          FOR ${command} ${clause} (organization_id = ${this.boundOrganization})
      `);
    }
    await queryRunner.query(`
      CREATE POLICY consolidation_member_tenant_update ON core.consolidation_member
        FOR UPDATE USING (organization_id = ${this.boundOrganization})
                WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.consolidation_member
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.consolidation_member`);
    await queryRunner.query(`
      ALTER TABLE core.reporting_entity
        DROP CONSTRAINT reporting_entity_consolidation_basis_known,
        DROP COLUMN consolidation_basis
    `);
  }
}
