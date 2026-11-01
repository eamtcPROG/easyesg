import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A validation run's roll-up (task 41.3; FR-41, UC-38; `architecture.md` §12.5.6's task-182 validation row, 182/18,
 * 182/19, and task-41 row (2), (g), (h)).
 *
 * **Computed by the run, read as it left it** (FR-41 item 8): the report's counts on the run row, and one row per module
 * in `core.validation_module` with the fields outstanding in it, which FR-164's notice names (FR-41 AC-6). **Counts,
 * never a percentage** (182/18); the status is derived from them on read, so it is never stored to disagree with them.
 *
 * **Readiness is read from the run row** (decision (2)): an open report whose latest run left nothing outstanding,
 * and something resolved or reasoned, reads ready to file — a fact of these columns, joined by the report and period
 * reads, and written by no one.
 *
 * The run's counts are added `NOT NULL` with a default of zero for any run a 41.2 build recorded — which reads as
 * *not started*, so never ready — and the default then dropped, so every later run must state them. The module rows go
 * with their run, inside the lock and exempt from it like the findings (182/21), replaced and never edited.
 */
export class ValidationRollUp1792368000000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.validation_run
        ADD COLUMN resolved    int NOT NULL DEFAULT 0,
        ADD COLUMN reasoned    int NOT NULL DEFAULT 0,
        ADD COLUMN outstanding int NOT NULL DEFAULT 0,
        ADD CONSTRAINT validation_run_counts_non_negative CHECK (resolved >= 0 AND reasoned >= 0 AND outstanding >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE core.validation_run
        ALTER COLUMN resolved DROP DEFAULT,
        ALTER COLUMN reasoned DROP DEFAULT,
        ALTER COLUMN outstanding DROP DEFAULT
    `);

    await queryRunner.query(`
      CREATE TABLE core.validation_module (
        organization_id    uuid  NOT NULL,
        report_id          uuid  NOT NULL,
        -- A module of the report's scope, by the standard's own reference (\`B1\`, \`C3\`).
        module             text  NOT NULL,

        resolved           int   NOT NULL,
        reasoned           int   NOT NULL,
        outstanding        int   NOT NULL,
        -- The outstanding fields' addresses, as a finding names its field (FR-42) — for FR-164's notice.
        outstanding_fields jsonb NOT NULL DEFAULT '[]'::jsonb,

        PRIMARY KEY (organization_id, report_id, module),
        CONSTRAINT validation_module_counts_non_negative
          CHECK (resolved >= 0 AND reasoned >= 0 AND outstanding >= 0),
        CONSTRAINT validation_module_outstanding_fields_is_list CHECK (jsonb_typeof(outstanding_fields) = 'array'),

        FOREIGN KEY (organization_id, report_id)
          REFERENCES core.validation_run (organization_id, report_id) ON DELETE CASCADE,
        FOREIGN KEY (report_id, organization_id)
          REFERENCES core.report (id, organization_id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON core.validation_module TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON core.validation_module TO esg_worker, esg_admin_ro`);

    await queryRunner.query(`ALTER TABLE core.validation_module ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.validation_module FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY validation_module_tenant_select ON core.validation_module
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY validation_module_tenant_insert ON core.validation_module
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY validation_module_tenant_delete ON core.validation_module
        FOR DELETE USING (organization_id = ${this.boundOrganization})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.validation_module`);
    await queryRunner.query(`
      ALTER TABLE core.validation_run
        DROP CONSTRAINT validation_run_counts_non_negative,
        DROP COLUMN outstanding,
        DROP COLUMN reasoned,
        DROP COLUMN resolved
    `);
  }
}
